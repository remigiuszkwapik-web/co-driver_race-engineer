<script setup lang="ts">
import type { Telemetry } from '../../server/utils/decode'
import { TRACE_BUFFER_SIZE } from '~/utils/trace'
import { INPUT_TRACE_LINES, motorTraceLines } from '~/utils/trace-lines'
import { emptyDynoState, ingestFrame, snapshot, type DynoCurve as Curve } from '~/utils/dyno'
import { pointsFromFrames } from '~/utils/track-map'
import { rollingCoastSeries, rollingOverlapSeries, rollingTb, seriesUpTo } from '~/utils/rolling-replay'
import { damperHistogramsForLap, damperScatterForLap } from '~/utils/damper-velocity'
import { rideHeightHistogramsForLap } from '~/utils/ride-height'
import { rpmDistribution, slipAngleBalanceDistribution } from '~/utils/channel-distributions'

const { format } = useUnits()

const props = defineProps<{
  frames: Telemetry[]
}>()

const {
  currentFrame,
  currentIndex,
  history,
  playing,
  playbackRate,
  totalMs,
  elapsedMs,
  toggle,
  pause,
  seekToIndex,
  seekToFraction
} = useReplay(props.frames)

const scrubFraction = computed({
  get(): number {
    if (totalMs.value <= 0) return 0
    return elapsedMs.value / totalMs.value
  },
  set(f: number) {
    seekToFraction(f)
  }
})

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000
  const m = Math.floor(totalSeconds / 60)
  const s = (totalSeconds - m * 60).toFixed(2).padStart(5, '0')
  return `${m}:${s}`
}

function onScrub(e: Event) {
  const target = e.target as HTMLInputElement
  pause()
  seekToFraction(Number(target.value))
}

// Speed sparkline behind the scrubber: drag straight to a braking zone / slow
// corner instead of hunting by time. Downsampled to a fixed point count and
// drawn in a stretched viewBox (preserveAspectRatio=none); the elapsed portion
// is clipped to a brighter stroke so the playhead reads at a glance.
const SPARK_W = 1000
const SPARK_H = 100
const sparkUid = useId()
const elapsedClipId = `scrub-elapsed-${sparkUid}`

const speedSpark = computed(() => {
  const f = props.frames
  if (f.length < 2) return { line: '', area: '' }
  let max = 1
  for (const fr of f) if (fr.speedKmh > max) max = fr.speedKmh
  const n = Math.min(300, f.length)
  const pts: string[] = []
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i / (n - 1)) * (f.length - 1))
    const v = f[idx]?.speedKmh ?? 0
    const x = (i / (n - 1)) * SPARK_W
    const y = SPARK_H - (v / max) * (SPARK_H - 4) - 2
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  const line = pts.join(' ')
  return { line, area: `0,${SPARK_H} ${line} ${SPARK_W},${SPARK_H}` }
})

const playheadX = computed(() => scrubFraction.value * SPARK_W)

// TraceStrip click maps to a lap-frame index. The strip's history is a
// sliding window ending at currentIndex; sample N in the window corresponds
// to lap frame `start + N` where start is max(0, currentIndex+1 - BUFFER).
function onTraceScrub(scrubBufferIdx: number | null) {
  if (scrubBufferIdx === null) return // snap-to-right-edge is a no-op in replay
  pause()
  const end = currentIndex.value + 1
  const start = Math.max(0, end - TRACE_BUFFER_SIZE)
  seekToIndex(start + scrubBufferIdx)
}

const RATES = [0.25, 0.5, 1, 2, 4] as const

function pickTickStep(totalS: number): number {
  if (totalS <= 10) return 1
  if (totalS <= 30) return 5
  if (totalS <= 90) return 10
  if (totalS <= 300) return 30
  return 60
}

function formatTick(s: number): string {
  if (s < 60) return `${Math.round(s)}s`
  const m = Math.floor(s / 60)
  const r = Math.round(s - m * 60)
  return r === 0 ? `${m}m` : `${m}:${r.toString().padStart(2, '0')}`
}

const timeTicks = computed(() => {
  const totalS = totalMs.value / 1000
  if (totalS <= 0) return [] as { percent: number, label: string }[]
  const step = pickTickStep(totalS)
  const ticks: { percent: number, label: string }[] = []
  // Stop one step short of total to avoid colliding with the trailing total label.
  const stop = totalS - step * 0.5
  for (let s = 0; s <= stop; s += step) {
    ticks.push({ percent: (s / totalS) * 100, label: formatTick(s) })
  }
  // Always pin the lap-end label at the right edge.
  ticks.push({ percent: 100, label: formatTick(totalS) })
  return ticks
})

function tickAnchorClass(percent: number): string {
  if (percent < 1) return 'left-0'
  if (percent > 99) return 'right-0'
  return '-translate-x-1/2'
}

function tickStyle(percent: number): Record<string, string> {
  if (percent < 1 || percent > 99) return {}
  return { left: percent + '%' }
}

// Same window-max approach as /live so the motor strip auto-scales as you
// scrub through the lap. The scales drift naturally with the visible window.
const motorLines = computed(() => {
  const h = history.value
  let mTq = 0
  let mPw = 0
  for (let i = 0; i < h.length; i++) {
    const s = h[i]!
    if (s.torqueNm > mTq) mTq = s.torqueNm
    if (s.powerKw > mPw) mPw = s.powerKw
  }
  return motorTraceLines({ maxTorqueNm: mTq, maxPowerKw: mPw }, { torque: format.torque, power: format.power })
})

// Dyno curve grows as the lap plays. Re-binning props.frames.slice(0, end)
// every tick was O(n) per frame → O(n²) over the lap, and the per-tick cost
// climbed as the slice grew (visible stutter late in long laps). Instead keep
// a streaming DynoState and ingest only the frames revealed since the last
// tick — amortized O(1) while playing forward. A backward seek or lap change
// can't un-do the running maxes, so those rebuild from scratch up to the
// current point. snapshot() folds the ~RPM-bin buckets and is cheap.
let dynoState = emptyDynoState()
let dynoEnd = 0 // frames [0, dynoEnd) already ingested into dynoState
let dynoFramesRef: Telemetry[] | null = null
const dynoCurve = shallowRef<Curve>(snapshot(dynoState))

watch([() => props.frames, currentIndex], () => {
  const frames = props.frames
  const end = currentIndex.value + 1
  if (frames !== dynoFramesRef || end < dynoEnd) {
    dynoState = emptyDynoState()
    dynoEnd = 0
    dynoFramesRef = frames
  }
  for (let i = dynoEnd; i < end; i++) {
    const f = frames[i]
    if (f) ingestFrame(dynoState, f)
  }
  dynoEnd = end
  dynoCurve.value = snapshot(dynoState)
}, { immediate: true })

// Track-map: compute once from the full lap (route doesn't change as you
// scrub). The moving dot comes from currentFrame.position — no need to
// index back into the downsampled points array.
const trackPoints = computed(() => pointsFromFrames(props.frames))

const trackCursor = computed(() => {
  const f = currentFrame.value
  if (!f || !f.position) return null
  // Skip the (0, 0, 0) loading frames the game emits before the car is
  // positioned — same filter `pointsFromFrames` uses. Without this, scrubbing
  // back into the loading region parks the cursor off-map at world origin.
  if (f.position.x === 0 && f.position.z === 0) return null
  return {
    x: f.position.x,
    z: f.position.z,
    y: f.position.y,
    distance: f.lap?.distance ?? 0
  }
})

// Click-to-seek on the map: find the frame whose world position is nearest the
// clicked point and jump the replay there. Skips (0, 0) loading-screen frames.
function onMapSeek(point: { x: number, z: number }) {
  const frames = props.frames
  if (frames.length === 0) return
  let bestIdx = -1
  let bestDist = Infinity
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!
    const px = f.position?.x
    const pz = f.position?.z
    if (px === undefined || pz === undefined) continue
    if (px === 0 && pz === 0) continue
    const dx = px - point.x
    const dz = pz - point.z
    const d2 = dx * dx + dz * dz
    if (d2 < bestDist) {
      bestDist = d2
      bestIdx = i
    }
  }
  if (bestIdx < 0) return
  pause()
  seekToIndex(bestIdx)
}

// Per-corner damper velocity histograms — whole-lap aggregate. Computed once
// from props.frames (no scrub interaction); the histogram shape *is* the
// measurement, so it stays static while the rest of the panel scrubs.
const damperHistograms = computed(() => damperHistogramsForLap(props.frames))

// Position-domain suspension companions, same whole-lap aggregate: where the
// chassis sits (ride-height histogram) and how bump/rebound couples with travel
// (damper position×velocity scatter).
const rideHeightHistograms = computed(() => rideHeightHistogramsForLap(props.frames))
const damperScatter = computed(() => damperScatterForLap(props.frames))

// Engine and chassis-balance distributions over the whole lap. RPM pairs with
// the dyno (engine output × where time was spent); slip-angle balance is the
// lap-scale understeer/oversteer read no per-frame view answers.
const rpmHistogram = computed(() => rpmDistribution(props.frames))
const slipAngleBalance = computed(() => slipAngleBalanceDistribution(props.frames))

// Rolling TB% / coast / pedal-overlap strips — the same measurements /live
// streams from the server, batch-computed here over the whole lap (replay has
// no live bus). Each full-lap series is computed once; the playhead window is
// applied per-frame so the strip's right-edge pill reads the *current* rolling
// value rather than the lap's last reading. TB% also carries its episode bands,
// which replace the old trace-strip overlay.
const TRACE_WINDOW_MS = (TRACE_BUFFER_SIZE / 60) * 1000

function fmtPct(v: number): string {
  return Math.round(v * 100) + '%'
}

// Right-edge of every strip in game-clock ms — the playhead frame's timestamp,
// so the measurement strips track the trace strip as the lap scrubs.
const latestT = computed<number>(() => currentFrame.value?.timestampMs ?? 0)

const tbReplay = computed(() => rollingTb(props.frames))
const coastSeriesFull = computed(() => rollingCoastSeries(props.frames))
const overlapSeriesFull = computed(() => rollingOverlapSeries(props.frames))

const tbSamples = computed(() => seriesUpTo(tbReplay.value.series, latestT.value))
const coastSamples = computed(() => seriesUpTo(coastSeriesFull.value, latestT.value))
const overlapSamples = computed(() => seriesUpTo(overlapSeriesFull.value, latestT.value))
</script>

<template>
  <div class="card p-4">
    <header class="mb-3 flex items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
      <span class="flex items-center gap-3">
        <span>Replay · {{ frames.length }} frames</span>
        <NuxtLink
          to="/manual/replay"
          class="inline-flex items-center gap-1 normal-case tracking-normal hover:text-green-300"
          title="How to read the graphs on this page"
        >
          <UIcon
            name="i-lucide-book-open"
            class="h-3 w-3"
          />
          <span>manual</span>
        </NuxtLink>
      </span>
      <span class="tabular-nums text-zinc-300">
        {{ formatTime(elapsedMs) }} / {{ formatTime(totalMs) }}
      </span>
    </header>

    <CornerView
      :frame="currentFrame"
      :paused="false"
    />

    <section class="space-y-3 px-6 pb-2">
      <!-- 3D chassis attitude — replay-only because the WebGL canvas is the
           heavy visualization in this set. CornerView's center column shows
           inputs + attitude readouts and the G-G dot instead. -->
      <div class="card aspect-[16/10] overflow-hidden p-2 sm:p-3">
        <CarAttitude3D :frame="currentFrame" />
      </div>
      <TraceStrip
        :history="history"
        :lines="INPUT_TRACE_LINES"
        label="traces · replay window"
        :paused="!playing"
        :scrubbable="true"
        :drag-scrub="false"
        :scrub-index="null"
        :buffer-length="history.length"
        @toggle-pause="toggle"
        @scrub="onTraceScrub"
      />
      <MeasurementStrip
        :series="[{ samples: tbSamples, bands: tbReplay.bands, color: '#a78bfa', pillLabel: 'TB%', fmt: fmtPct }]"
        :window-ms="TRACE_WINDOW_MS"
        label="TB% · 30 s"
        :latest-t="latestT"
      />
      <MeasurementStrip
        :series="[{ samples: coastSamples, color: '#a1a1aa', pillLabel: 'CST', fmt: fmtPct }]"
        :window-ms="TRACE_WINDOW_MS"
        label="coast · 30 s"
        :latest-t="latestT"
      />
      <MeasurementStrip
        :series="[{ samples: overlapSamples, color: '#fb923c', pillLabel: 'OVL', fmt: fmtPct }]"
        :window-ms="TRACE_WINDOW_MS"
        label="pedal overlap · 30 s"
        :latest-t="latestT"
      />
      <TraceStrip
        :history="history"
        :lines="motorLines"
        label="motor · replay window"
        :paused="!playing"
        :scrubbable="true"
        :drag-scrub="false"
        :scrub-index="null"
        :buffer-length="history.length"
        :show-pause-button="false"
        @scrub="onTraceScrub"
      />
      <DynoCurve
        :curve="dynoCurve"
        title="dyno · this lap so far"
        mode="detailed"
        :current-rpm="currentFrame?.rpm ?? 0"
      />
      <ChannelHistogram
        :histogram="rpmHistogram"
        title="time at rpm · whole lap"
        unit="rpm"
      />
      <SuspensionHistogram
        :histograms="damperHistograms"
        title="damper velocity · whole lap"
      />
      <DamperScatter
        :scatter="damperScatter"
        title="damper position × velocity · whole lap"
      />
      <RideHeightHistogram
        :histograms="rideHeightHistograms"
        title="ride height · whole lap"
      />
      <ChannelHistogram
        :histogram="slipAngleBalance"
        title="balance · front − rear slip angle · whole lap"
        subtitle="cornering only"
        unit="°"
        :signed="true"
        left-label="oversteer"
        right-label="understeer"
      />
      <TrackMap
        :points="trackPoints"
        :current-point="trackCursor"
        :seekable="true"
        title="track · this lap"
        @seek-to-position="onMapSeek"
      />
    </section>

    <div class="sticky bottom-0 z-10 -mx-4 -mb-4 mt-2 flex items-center gap-3 border-t border-zinc-800 bg-zinc-950/90 px-6 py-3 backdrop-blur">
      <button
        type="button"
        class="rounded-sm border border-zinc-700 bg-zinc-900 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-200 transition-colors hover:border-green-500/60 hover:text-green-300"
        @click="toggle"
      >
        {{ playing ? '❚❚ Pause' : '▶ Play' }}
      </button>
      <div class="flex flex-1 flex-col gap-0.5">
        <div class="relative h-9">
          <!-- Speed shape behind the track: faint full line + brighter elapsed
               portion (clipped to the playhead) + an area fill under it. -->
          <svg
            class="pointer-events-none absolute inset-0 h-full w-full"
            :viewBox="`0 0 ${SPARK_W} ${SPARK_H}`"
            preserveAspectRatio="none"
          >
            <defs>
              <clipPath :id="elapsedClipId">
                <rect
                  x="0"
                  y="0"
                  :width="playheadX"
                  :height="SPARK_H"
                />
              </clipPath>
            </defs>
            <polygon
              v-if="speedSpark.area"
              :points="speedSpark.area"
              fill="#22c55e"
              opacity="0.06"
            />
            <polyline
              v-if="speedSpark.line"
              :points="speedSpark.line"
              fill="none"
              stroke="#52525b"
              stroke-width="1"
              vector-effect="non-scaling-stroke"
            />
            <polyline
              v-if="speedSpark.line"
              :points="speedSpark.line"
              fill="none"
              stroke="#86efac"
              stroke-width="1.25"
              vector-effect="non-scaling-stroke"
              :clip-path="`url(#${elapsedClipId})`"
            />
            <line
              :x1="playheadX"
              :x2="playheadX"
              y1="0"
              :y2="SPARK_H"
              stroke="#4ade80"
              stroke-width="1.5"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <input
            :value="scrubFraction"
            type="range"
            min="0"
            max="1"
            step="0.001"
            class="scrub-overlay absolute inset-0 h-full w-full"
            aria-label="Seek through the lap"
            @input="onScrub"
          >
        </div>
        <div
          v-if="timeTicks.length > 0"
          class="relative h-3 select-none font-mono text-[9px] tabular-nums text-zinc-500"
        >
          <span
            v-for="tick in timeTicks"
            :key="tick.percent"
            class="absolute top-0"
            :class="tickAnchorClass(tick.percent)"
            :style="tickStyle(tick.percent)"
          >{{ tick.label }}</span>
        </div>
      </div>
      <select
        v-model.number="playbackRate"
        class="rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-200"
      >
        <option
          v-for="r in RATES"
          :key="r"
          :value="r"
        >
          {{ r }}x
        </option>
      </select>
    </div>
  </div>
</template>

<style scoped>
/* The scrubber is a transparent range input layered over the speed sparkline.
   The visible playhead is the SVG line underneath; the native thumb is an
   invisible grab target riding over it. Track is transparent so the sparkline
   shows through; thumb height matches the h-9 (36px) container. */
.scrub-overlay {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
}
.scrub-overlay:focus {
  outline: none;
}
.scrub-overlay::-webkit-slider-runnable-track {
  background: transparent;
  height: 100%;
}
.scrub-overlay::-moz-range-track {
  background: transparent;
  height: 100%;
}
.scrub-overlay::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 36px;
  background: transparent;
}
.scrub-overlay::-moz-range-thumb {
  width: 10px;
  height: 36px;
  border: none;
  background: transparent;
}
</style>
