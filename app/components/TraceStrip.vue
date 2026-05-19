<script setup lang="ts">
import { TRACE_BUFFER_SIZE, type TraceSample } from '~/utils/trace'

const props = defineProps<{
  history: TraceSample[]
  paused: boolean
}>()

const emit = defineEmits<{ togglePause: [] }>()

const VIEW_W = 1000
const VIEW_H = 160
const PAD_T = 12
const PAD_B = 18
const TRACE_H = VIEW_H - PAD_T - PAD_B

const YAW_RATE_RANGE = 3 // rad/s — clamps the line height

const colors = {
  throttle: '#22c55e',
  brake: '#ef4444',
  steer: '#f59e0b',
  yawRate: '#3b82f6'
}

interface LineDef {
  key: keyof Pick<TraceSample, 'throttle' | 'brake' | 'steer' | 'yawRate'>
  label: string
  /** normalize sample value to 0..1 (1 = top of strip) */
  norm: (v: number) => number
  /** how to format the current-value pill text */
  fmt: (v: number) => string
  color: string
}

const lines: LineDef[] = [
  { key: 'throttle', label: 'THROTL', color: colors.throttle, norm: v => 1 - clamp01(v), fmt: v => Math.round(v * 100) + '%' },
  { key: 'brake', label: 'BRAKE', color: colors.brake, norm: v => 1 - clamp01(v), fmt: v => Math.round(v * 100) + '%' },
  { key: 'steer', label: 'STEER', color: colors.steer, norm: v => 0.5 - clamp(v, -1, 1) / 2, fmt: v => (v >= 0 ? '+' : '') + Math.round(v * 100) + '%' },
  { key: 'yawRate', label: 'YAW/s', color: colors.yawRate, norm: v => 0.5 - clamp(v, -YAW_RATE_RANGE, YAW_RATE_RANGE) / (YAW_RATE_RANGE * 2), fmt: v => v.toFixed(2) }
]

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
function clamp01(v: number): number {
  return clamp(v, 0, 1)
}

/**
 * Plot the buffer as an SVG polyline points string. The buffer's logical
 * x-axis is fixed to TRACE_BUFFER_SIZE — short buffers (just-started) draw
 * a line that fills the right side, leaving the left empty.
 */
function pathFor(line: LineDef): string {
  const h = props.history
  if (h.length < 2) return ''
  const xStep = VIEW_W / (TRACE_BUFFER_SIZE - 1)
  const offset = TRACE_BUFFER_SIZE - h.length
  let out = ''
  for (let i = 0; i < h.length; i++) {
    const sample = h[i]!
    const x = (offset + i) * xStep
    const y = PAD_T + line.norm(sample[line.key]) * TRACE_H
    out += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' '
  }
  return out.trim()
}

const latest = computed<TraceSample | null>(() => {
  return props.history.length > 0 ? props.history[props.history.length - 1] ?? null : null
})

// 0.5 represents the zero-line for centered signals (steer, yawRate).
const midY = PAD_T + 0.5 * TRACE_H
</script>

<template>
  <section class="rounded-lg border border-zinc-800 bg-zinc-900/80 p-4 font-mono text-zinc-100 backdrop-blur">
    <header class="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-zinc-400">
      <span>traces · last 10 s</span>
      <span class="flex items-center gap-3">
        <span class="flex items-center gap-1.5">
          <span
            class="inline-block h-1.5 w-3"
            :style="{ background: colors.throttle }"
          />throttle
        </span>
        <span class="flex items-center gap-1.5">
          <span
            class="inline-block h-1.5 w-3"
            :style="{ background: colors.brake }"
          />brake
        </span>
        <span class="flex items-center gap-1.5">
          <span
            class="inline-block h-1.5 w-3"
            :style="{ background: colors.steer }"
          />steer
        </span>
        <span class="flex items-center gap-1.5">
          <span
            class="inline-block h-1.5 w-3"
            :style="{ background: colors.yawRate }"
          />yaw/s
        </span>
        <button
          type="button"
          class="rounded border border-zinc-700 px-2 py-0.5 text-zinc-200 hover:bg-zinc-800"
          :class="paused ? 'bg-amber-500/10 text-amber-300 border-amber-700/50' : ''"
          @click="emit('togglePause')"
        >
          {{ paused ? 'RESUME' : 'PAUSE' }}
        </button>
      </span>
    </header>

    <div class="relative">
      <svg
        :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
        class="w-full"
        preserveAspectRatio="none"
      >
        <!-- Grid: horizontal midline (zero for centered signals) and 25/75 references -->
        <line
          x1="0"
          :y1="midY"
          :x2="VIEW_W"
          :y2="midY"
          stroke="#3f3f46"
          stroke-width="0.5"
          stroke-dasharray="3,3"
        />
        <line
          x1="0"
          :y1="PAD_T + TRACE_H * 0.25"
          :x2="VIEW_W"
          :y2="PAD_T + TRACE_H * 0.25"
          stroke="#27272a"
          stroke-width="0.5"
        />
        <line
          x1="0"
          :y1="PAD_T + TRACE_H * 0.75"
          :x2="VIEW_W"
          :y2="PAD_T + TRACE_H * 0.75"
          stroke="#27272a"
          stroke-width="0.5"
        />

        <!-- Time tick markers: every 2.5s -->
        <g
          v-for="i in 4"
          :key="i"
        >
          <line
            :x1="VIEW_W * (i / 4)"
            :y1="PAD_T"
            :x2="VIEW_W * (i / 4)"
            :y2="VIEW_H - PAD_B"
            stroke="#27272a"
            stroke-width="0.5"
          />
        </g>

        <!-- Trace lines -->
        <path
          v-for="line in lines"
          :key="line.key"
          :d="pathFor(line)"
          fill="none"
          :stroke="line.color"
          stroke-width="1.5"
          stroke-linejoin="round"
          stroke-linecap="round"
          opacity="0.95"
        />

        <!-- Time axis labels -->
        <text
          v-for="i in 5"
          :key="`t${i}`"
          :x="VIEW_W * ((i - 1) / 4)"
          :y="VIEW_H - 4"
          :text-anchor="i === 1 ? 'start' : i === 5 ? 'end' : 'middle'"
          fill="#71717a"
          font-size="8"
          font-family="monospace"
        >
          {{ -10 + (i - 1) * 2.5 === 0 ? 'now' : (-10 + (i - 1) * 2.5).toFixed(1) + 's' }}
        </text>
      </svg>

      <!-- Current-value pills floating against the right edge -->
      <div
        v-if="latest"
        class="pointer-events-none absolute top-0 right-0 flex h-full flex-col justify-around pr-1 text-[10px] tabular-nums"
      >
        <span
          v-for="line in lines"
          :key="line.key"
          class="rounded px-1.5 py-0.5"
          :style="{ background: line.color + '20', color: line.color }"
        >
          {{ line.label }} {{ line.fmt(latest[line.key]) }}
        </span>
      </div>
    </div>
  </section>
</template>
