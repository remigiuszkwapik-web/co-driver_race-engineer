<script setup lang="ts">
const props = defineProps<{
  /** body-frame longitudinal acceleration (m/s²) — +ve forward */
  accelLong: number
  /** body-frame lateral acceleration (m/s²) — +ve to one side */
  accelLat: number
}>()

// 2g range on each axis. Matches Forza's in-game G meter: braking plots UP
// (driver felt forward), accelerating plots DOWN (driver pushed back into seat).
const G_RANGE_MPS2 = 20

// Trail rendered as a fading scatter — pros read the *envelope* (density
// across the disc), not the path. Decimate to ~10 Hz so 200 dots cover ~20 s
// of history; the instantaneous "now" dot still updates at 60 Hz from props.
const TRAIL_SAMPLES = 200
const TRAIL_DECIMATE = 6

interface GPoint { x: number, y: number }
const trail = ref<GPoint[]>([])
// Bumped only when `trail` actually mutates (~10 Hz after decimation). The
// template v-memos the 200-node trail group against it so that subtree is
// skipped on the ~5 of every 6 frames where only the live "now" dot moves —
// the component still re-renders at 60 Hz for the now dot, but the heavy
// scatter doesn't re-diff each time.
const trailRev = ref(0)
let frameCounter = 0

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function ggDot(): GPoint {
  const xs = 50 + clamp(props.accelLat / G_RANGE_MPS2, -1, 1) * 48
  const ys = 50 + clamp(props.accelLong / G_RANGE_MPS2, -1, 1) * 48
  return { x: xs, y: ys }
}

watch(() => [props.accelLat, props.accelLong] as const, () => {
  frameCounter++
  if (frameCounter % TRAIL_DECIMATE !== 0) return
  trail.value.push(ggDot())
  if (trail.value.length > TRAIL_SAMPLES) trail.value.shift()
  trailRev.value++
}, { immediate: true })

const dotPos = computed<GPoint>(() => ggDot())
const lateralG = computed(() => props.accelLat / 9.81)
const longG = computed(() => props.accelLong / 9.81)

function signedFixed(v: number, digits: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(digits)
}
</script>

<template>
  <div class="relative">
    <svg
      viewBox="0 0 100 100"
      class="aspect-square w-full"
    >
      <defs>
        <radialGradient id="ggBackdrop">
          <stop
            offset="0%"
            stop-color="#0f0f12"
          />
          <stop
            offset="100%"
            stop-color="#18181b"
          />
        </radialGradient>
        <filter
          id="ggDotGlow"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>

      <!-- backdrop -->
      <circle
        cx="50"
        cy="50"
        r="48"
        fill="url(#ggBackdrop)"
        stroke="#3f3f46"
        stroke-width="0.6"
      />
      <!-- crosshair -->
      <line
        x1="50"
        y1="3"
        x2="50"
        y2="97"
        stroke="#52525b"
        stroke-width="0.4"
      />
      <line
        x1="3"
        y1="50"
        x2="97"
        y2="50"
        stroke="#52525b"
        stroke-width="0.4"
      />
      <!-- 1g ring (inner) and 2g ring (outer) -->
      <circle
        cx="50"
        cy="50"
        r="24"
        fill="none"
        stroke="#52525b"
        stroke-width="0.4"
        stroke-dasharray="2,2"
      />
      <circle
        cx="50"
        cy="50"
        r="48"
        fill="none"
        stroke="#3f3f46"
        stroke-width="0.4"
        stroke-dasharray="1,2"
      />
      <!-- axis ticks at 1g and 2g -->
      <g
        stroke="#52525b"
        stroke-width="0.5"
      >
        <line
          x1="26"
          y1="48"
          x2="26"
          y2="52"
        />
        <line
          x1="74"
          y1="48"
          x2="74"
          y2="52"
        />
        <line
          x1="48"
          y1="26"
          x2="52"
          y2="26"
        />
        <line
          x1="48"
          y1="74"
          x2="52"
          y2="74"
        />
      </g>
      <!-- ring labels -->
      <text
        x="50"
        y="28.5"
        text-anchor="middle"
        fill="#52525b"
        font-size="3.2"
        font-family="monospace"
      >1g</text>
      <text
        x="50"
        y="4.5"
        text-anchor="middle"
        fill="#3f3f46"
        font-size="3.2"
        font-family="monospace"
      >2g</text>
      <!-- Envelope scatter — opacity ramps from oldest (~invisible) to
           newest (~0.55) so density carries the visual weight. The
           brighter "now" dot below sits on top. -->
      <g v-memo="[trailRev]">
        <circle
          v-for="(p, i) in trail"
          :key="i"
          :cx="p.x"
          :cy="p.y"
          r="0.75"
          fill="#fbbf24"
          :opacity="((i + 1) / trail.length) * 0.55"
        />
      </g>
      <!-- current point — glow + solid -->
      <circle
        :cx="dotPos.x"
        :cy="dotPos.y"
        r="4.2"
        fill="#22c55e"
        opacity="0.4"
        filter="url(#ggDotGlow)"
      />
      <circle
        :cx="dotPos.x"
        :cy="dotPos.y"
        r="3"
        fill="#4ade80"
        stroke="#0f0f12"
        stroke-width="0.6"
      />
    </svg>
    <div class="absolute top-2 left-2 text-xs uppercase tracking-[0.25em] text-zinc-500">
      G-G
    </div>
    <div class="absolute right-2 bottom-2 font-mono text-xs tabular-nums text-zinc-300">
      {{ signedFixed(lateralG, 2) }} <span class="text-zinc-500">·</span> {{ signedFixed(longG, 2) }} <span class="text-zinc-500">g</span>
    </div>
  </div>
</template>
