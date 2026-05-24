<script setup lang="ts">
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { alignByDistance, type AlignedSeries, type AlignFrame } from '~/utils/align'
import { formatDelta } from '~/utils/format'

const { format } = useUnits()

const props = defineProps<{
  framesA: AlignFrame[]
  framesB: AlignFrame[]
  labelA?: string
  labelB?: string
  /** distance bucket step in meters */
  step?: number
}>()

const COLOR_A = '#fafafa'
const COLOR_B = '#fbbf24'
const COLOR_DELTA_A_AHEAD = '#22c55e'
const COLOR_DELTA_B_AHEAD = '#f59e0b'

// Sync group key: every plot in this instance shares cursor + x-scale via uPlot.sync.
const uid = Math.random().toString(36).slice(2, 9)
const syncKey = `overlay-${uid}`

const a = computed<AlignedSeries>(() => alignByDistance(props.framesA, props.step ?? 1))
const b = computed<AlignedSeries>(() => alignByDistance(props.framesB, props.step ?? 1))

// Shared distance domain: the shorter of the two so we don't extrapolate.
const sharedLen = computed(() => Math.min(a.value.distance.length, b.value.distance.length))

// Shared x-array (distance in meters). uPlot wants a single x per plot — both
// laps are already on the same distance grid via alignByDistance.
const xs = computed<Float64Array>(() => {
  const n = sharedLen.value
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) out[i] = a.value.distance[i]!
  return out
})

// Delta (B.elapsedMs − A.elapsedMs) per shared bucket. Positive = A is ahead.
const delta = computed<Float64Array>(() => {
  const n = sharedLen.value
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) out[i] = b.value.elapsedMs[i]! - a.value.elapsedMs[i]!
  return out
})

// Symmetric y-bound for the delta row, snapped to a "nice" number.
const deltaBoundMs = computed(() => {
  let m = 0
  const d = delta.value
  for (let i = 0; i < d.length; i++) {
    const v = Math.abs(d[i]!)
    if (v > m) m = v
  }
  if (m === 0) return 1000
  const nice = [250, 500, 1000, 2000, 5000, 10000, 30000]
  for (const n of nice) if (m <= n) return n
  return Math.ceil(m / 1000) * 1000
})

const finalDeltaMs = computed(() => {
  const n = sharedLen.value
  return n > 0 ? delta.value[n - 1]! : 0
})

// --- Row definitions -----------------------------------------------------
// Each entry becomes one synced uPlot instance.
type RowKey = 'throttle' | 'brake' | 'steer' | 'delta'
interface Row {
  key: RowKey
  label: string
  fmt: (v: number) => string
}
const rows: Row[] = [
  { key: 'throttle', label: 'THROTL', fmt: v => Math.round(v * 100) + '%' },
  { key: 'brake', label: 'BRAKE', fmt: v => Math.round(v * 100) + '%' },
  { key: 'steer', label: 'STEER', fmt: v => (v >= 0 ? '+' : '') + v.toFixed(2) },
  { key: 'delta', label: 'Δ TIME', fmt: v => formatDelta(v) + 's' }
]

const ROW_H = 90

// --- uPlot lifecycle ------------------------------------------------------
const plotEls = ref<HTMLDivElement[]>([])
const plots: uPlot[] = []
let resizeObs: ResizeObserver | null = null

// Cursor index (synced across plots). null when pointer leaves the strip.
const cursorIdx = ref<number | null>(null)

function f32To64(src: Float32Array, n: number): Float64Array {
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) out[i] = src[i]!
  return out
}

function buildData(row: Row): uPlot.AlignedData {
  const n = sharedLen.value
  if (n === 0) return [new Float64Array(0)] as unknown as uPlot.AlignedData
  if (row.key === 'delta') {
    return [xs.value, delta.value] as unknown as uPlot.AlignedData
  }
  return [
    xs.value,
    f32To64(a.value[row.key], n),
    f32To64(b.value[row.key], n)
  ] as unknown as uPlot.AlignedData
}

function buildOpts(row: Row, isLast: boolean, width: number): uPlot.Options {
  const isDelta = row.key === 'delta'
  const series: uPlot.Series[] = [
    { label: 'd' },
    ...(isDelta
      ? [{
          label: 'Δ',
          // Single line, two colours: green where A is ahead (positive,
          // above zero in plot-y) and amber where B is ahead. Implemented
          // as a vertical CanvasGradient that flips at the zero pixel —
          // recomputed each draw so it stays correct when the y-scale
          // changes (e.g. after a zoom).
          stroke: (u: uPlot) => {
            const top = u.bbox.top
            const h = u.bbox.height
            const bot = top + h
            const yZero = u.valToPos(0, 'y', true)
            if (yZero <= top) return COLOR_DELTA_B_AHEAD
            if (yZero >= bot) return COLOR_DELTA_A_AHEAD
            const grad = u.ctx.createLinearGradient(0, top, 0, bot)
            const f = (yZero - top) / h
            // Hard stop at the zero line — two abutting colour-stops give
            // a sharp boundary instead of a fade.
            grad.addColorStop(0, COLOR_DELTA_A_AHEAD)
            grad.addColorStop(f, COLOR_DELTA_A_AHEAD)
            grad.addColorStop(f, COLOR_DELTA_B_AHEAD)
            grad.addColorStop(1, COLOR_DELTA_B_AHEAD)
            return grad
          },
          width: 1.6,
          points: { show: false }
        }]
      : [
          { label: 'A', stroke: COLOR_A, width: 1.4, points: { show: false } },
          { label: 'B', stroke: COLOR_B, width: 1.4, points: { show: false } }
        ])
  ]

  return {
    width,
    height: ROW_H,
    pxAlign: 0,
    legend: { show: false },
    cursor: {
      // sync across all rows: cursor position + x-scale zoom both propagate.
      sync: { key: syncKey, setSeries: false, scales: ['x', null] as [string | null, string | null] },
      drag: { x: true, y: false, setScale: true },
      points: { show: false }
    },
    select: { show: true, left: 0, top: 0, width: 0, height: 0 },
    axes: [
      {
        stroke: '#71717a',
        grid: { stroke: '#27272a', width: 0.5 },
        ticks: { stroke: '#27272a', width: 0.5, size: 4 },
        font: '9px monospace',
        show: isLast,
        size: isLast ? 22 : 0,
        values: (_u, vals) => vals.map(v => format.distance(v).replace(/\s+/g, ''))
      },
      {
        stroke: '#71717a',
        grid: { stroke: '#27272a', width: 0.5 },
        ticks: { stroke: '#27272a', width: 0.5, size: 4 },
        font: '9px monospace',
        size: 44,
        values: (_u, vals) => vals.map((v) => {
          if (isDelta) return (v / 1000).toFixed(Math.abs(v) >= 1000 ? 0 : 1) + 's'
          if (row.key === 'steer') return v.toFixed(1)
          return Math.round(v * 100) + '%'
        })
      }
    ],
    scales: {
      x: { time: false },
      y: isDelta
        ? { range: () => [-deltaBoundMs.value, deltaBoundMs.value] }
        : row.key === 'steer'
          ? { range: () => [-1, 1] }
          : { range: () => [0, 1] }
    },
    series,
    hooks: {
      setCursor: [
        (u: uPlot) => {
          const idx = u.cursor.idx
          cursorIdx.value = (idx === undefined || idx === null) ? null : idx
        }
      ],
      draw: isDelta ? [drawDeltaZeroLine] : (row.key === 'steer' ? [drawSteerZeroLine] : [])
    }
  }
}

// Mid-line at zero for steer and delta rows: drawn directly on the canvas
// so it sits behind the trace but ahead of the grid.
function drawSteerZeroLine(u: uPlot): void {
  drawHorizontalLine(u, 0, '#3f3f46')
}
function drawDeltaZeroLine(u: uPlot): void {
  drawHorizontalLine(u, 0, '#3f3f46')
}
function drawHorizontalLine(u: uPlot, yVal: number, color: string): void {
  const ctx = u.ctx
  const py = u.valToPos(yVal, 'y', true)
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 0.5
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(u.bbox.left, py)
  ctx.lineTo(u.bbox.left + u.bbox.width, py)
  ctx.stroke()
  ctx.restore()
}

function renderPlots(): void {
  destroyPlots()
  if (sharedLen.value === 0) return
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const el = plotEls.value[i]
    if (!el) continue
    const w = el.clientWidth || 1000
    plots[i] = new uPlot(buildOpts(row, i === rows.length - 1, w), buildData(row), el)
  }
}

function destroyPlots(): void {
  for (const p of plots) p?.destroy()
  plots.length = 0
}

function resetZoom(): void {
  if (sharedLen.value === 0) return
  const min = xs.value[0] ?? 0
  const max = xs.value[sharedLen.value - 1] ?? 0
  // cursor.sync only propagates cursor + drag-zoom — a programmatic
  // setScale fires only on the target plot, so loop over the group.
  for (const p of plots) p?.setScale('x', { min, max })
}

onMounted(() => {
  renderPlots()
  resizeObs = new ResizeObserver(() => {
    for (let i = 0; i < plots.length; i++) {
      const p = plots[i]
      const el = plotEls.value[i]
      if (!p || !el) continue
      const w = el.clientWidth
      if (w > 0) p.setSize({ width: w, height: ROW_H })
    }
  })
  for (const el of plotEls.value) resizeObs.observe(el)
})

onBeforeUnmount(() => {
  resizeObs?.disconnect()
  destroyPlots()
})

// Rebuild when the data identity changes — sharedLen captures lap swap,
// xs identity captures step change.
watch([sharedLen, xs], () => {
  nextTick(() => renderPlots())
})

// --- Hover-value pills ----------------------------------------------------
interface HoverValues {
  distance: number
  rows: Array<{ key: RowKey, a: number, b: number | null }>
}
const hoverValues = computed<HoverValues | null>(() => {
  const i = cursorIdx.value
  if (i === null || i < 0 || i >= sharedLen.value) return null
  return {
    distance: xs.value[i]!,
    rows: [
      { key: 'throttle', a: a.value.throttle[i]!, b: b.value.throttle[i]! },
      { key: 'brake', a: a.value.brake[i]!, b: b.value.brake[i]! },
      { key: 'steer', a: a.value.steer[i]!, b: b.value.steer[i]! },
      { key: 'delta', a: delta.value[i]!, b: null }
    ]
  }
})

function valueFor(row: Row, side: 'a' | 'b'): string {
  const hv = hoverValues.value
  if (!hv) return ''
  const entry = hv.rows.find(r => r.key === row.key)
  if (!entry) return ''
  if (side === 'b' && entry.b === null) return ''
  return row.fmt(side === 'a' ? entry.a : entry.b!)
}
</script>

<template>
  <section class="panel p-4 font-mono text-zinc-100 backdrop-blur">
    <header class="mb-3 flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
      <span class="flex items-center gap-3">
        <span>traces · by distance</span>
        <span
          v-if="hoverValues"
          class="rounded bg-zinc-800/80 px-1.5 py-0.5 normal-case tracking-normal text-zinc-200 tabular-nums"
        >
          @ {{ format.distance(hoverValues.distance).replace(/\s+/g, '') }}
        </span>
        <button
          v-if="sharedLen > 0"
          type="button"
          class="rounded border border-zinc-700 px-1.5 py-0.5 normal-case tracking-normal text-zinc-300 hover:bg-zinc-800"
          :title="'Reset zoom (or double-click any row)'"
          @click="resetZoom"
        >
          reset zoom
        </button>
      </span>
      <span class="flex flex-wrap items-center gap-4">
        <span class="flex items-center gap-1.5">
          <span
            class="inline-block h-1.5 w-3"
            :style="{ background: COLOR_A }"
          />A {{ labelA ? '· ' + labelA : '' }}
        </span>
        <span class="flex items-center gap-1.5">
          <span
            class="inline-block h-1.5 w-3"
            :style="{ background: COLOR_B }"
          />B {{ labelB ? '· ' + labelB : '' }}
        </span>
        <span class="flex items-center gap-1.5">
          <span class="text-zinc-500">Δ at finish</span>
          <span
            class="rounded px-1.5 py-0.5 tabular-nums"
            :style="{
              background: finalDeltaMs > 0 ? COLOR_DELTA_A_AHEAD + '20' : COLOR_DELTA_B_AHEAD + '20',
              color: finalDeltaMs > 0 ? COLOR_DELTA_A_AHEAD : COLOR_DELTA_B_AHEAD
            }"
          >
            {{ formatDelta(finalDeltaMs) }} s
          </span>
        </span>
      </span>
    </header>

    <p class="mb-2 text-[10px] text-zinc-600">
      drag to zoom · double-click to reset · move pointer to scrub
    </p>

    <div
      v-if="sharedLen === 0"
      class="py-12 text-center text-xs text-zinc-500"
    >
      No overlapping distance — laps have no comparable range.
    </div>
    <div
      v-else
      class="space-y-0.5"
    >
      <div
        v-for="(row, i) in rows"
        :key="row.key"
        class="relative"
      >
        <span class="pointer-events-none absolute left-12 top-1 z-10 text-[9px] uppercase tracking-[0.2em] text-zinc-500">
          {{ row.label }}<template v-if="row.key === 'delta'">
            · ±{{ (deltaBoundMs / 1000).toFixed(deltaBoundMs >= 1000 ? 0 : 1) }}s
          </template>
        </span>
        <span
          v-if="hoverValues"
          class="pointer-events-none absolute right-1 top-1 z-10 flex gap-1 text-[10px] tabular-nums"
        >
          <span
            v-if="row.key !== 'delta'"
            class="rounded px-1.5 py-0.5"
            :style="{ background: COLOR_A + '20', color: COLOR_A }"
          >
            {{ valueFor(row, 'a') }}
          </span>
          <span
            v-if="row.key !== 'delta'"
            class="rounded px-1.5 py-0.5"
            :style="{ background: COLOR_B + '20', color: COLOR_B }"
          >
            {{ valueFor(row, 'b') }}
          </span>
          <span
            v-else
            class="rounded px-1.5 py-0.5"
            :style="{
              background: (hoverValues.rows[3]?.a ?? 0) > 0 ? COLOR_DELTA_A_AHEAD + '20' : COLOR_DELTA_B_AHEAD + '20',
              color: (hoverValues.rows[3]?.a ?? 0) > 0 ? COLOR_DELTA_A_AHEAD : COLOR_DELTA_B_AHEAD
            }"
          >
            {{ valueFor(row, 'a') }}
          </span>
        </span>
        <div
          ref="plotEls"
          class="overlay-plot w-full"
          :style="{ height: (i === rows.length - 1 ? ROW_H + 22 : ROW_H) + 'px' }"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.overlay-plot :deep(.u-axis) {
  color: #71717a;
}
.overlay-plot :deep(.u-legend) {
  display: none;
}
.overlay-plot :deep(.u-select) {
  background: rgba(34, 211, 238, 0.12);
  border: 1px solid rgba(34, 211, 238, 0.4);
}
.overlay-plot :deep(.u-cursor-x),
.overlay-plot :deep(.u-cursor-y) {
  border-color: rgba(250, 250, 250, 0.5);
}
</style>
