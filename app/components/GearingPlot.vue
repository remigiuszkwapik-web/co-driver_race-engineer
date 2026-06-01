<script setup lang="ts">
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { buildGearingGrid, type GearingGrid, type GearingModel } from '~/utils/gearing'
import type { DynoCurve } from '~/utils/dyno'

const { prefs, format, unitLabel } = useUnits()

const props = withDefaults(defineProps<{
  /** Dyno torque/power curve — supplies the engine output mapped onto each gear. */
  dyno: DynoCurve
  /** Measured gear ratios + rolling radius. */
  model: GearingModel
  title?: string
  subtitle?: string
}>(), {
  title: 'gearing',
  subtitle: ''
})

const KMH_TO_MPH = 0.621371
const N_TO_LBF = 0.224809
const KW_TO_HP = 1.34102
const KW_TO_PS = 1.35962

// Per-gear hues — distinct enough to read 8+ overlapping curves at a glance.
const GEAR_COLORS = [
  '#22d3ee', '#34d399', '#a3e635', '#facc15', '#fb923c',
  '#f87171', '#e879f9', '#a855f7', '#818cf8', '#60a5fa'
]
function gearColor(gear: number): string {
  return GEAR_COLORS[(gear - 1) % GEAR_COLORS.length]!
}

// All panels share this instance's cursor + x-scale sync group.
const uid = Math.random().toString(36).slice(2, 9)
const syncKey = `gearing-${uid}`

// --- display converters ---------------------------------------------------
const dispSpeed = (kmh: number) => prefs.value.speed === 'mph' ? kmh * KMH_TO_MPH : kmh
const forceUnit = computed(() => prefs.value.downforce === 'lb' ? 'lbf' : 'kN')
const dispForceNum = (n: number) => prefs.value.downforce === 'lb' ? n * N_TO_LBF : n / 1000
const dispPowerNum = (kw: number) => {
  if (prefs.value.power === 'hp') return kw * KW_TO_HP
  if (prefs.value.power === 'ps') return kw * KW_TO_PS
  return kw
}

// --- panel definitions ----------------------------------------------------
type PanelKey = 'force' | 'power' | 'rpm'
interface Panel {
  key: PanelKey
  label: string
  unit: string
  height: number
  /** y-axis upper bound. */
  max: () => number
  /** hover-pill formatter. */
  fmt: (v: number) => string
  /** y-axis tick formatter. */
  axis: (v: number) => string
}

// Throttled snapshot of the grid — recomputed off the live curve at most a few
// times a second so the canvases aren't torn down every frame (rAF pacing).
const grid = shallowRef<GearingGrid>(buildGearingGrid(props.dyno, props.model))

const allPanels: Panel[] = [
  {
    key: 'force',
    label: 'TRACTIVE FORCE',
    unit: forceUnit.value,
    height: 168,
    max: () => Math.max(grid.value.maxForceN * 1.05, 1),
    fmt: v => `${dispForceNum(v).toFixed(prefs.value.downforce === 'lb' ? 0 : 1)} ${forceUnit.value}`,
    axis: v => dispForceNum(v).toFixed(prefs.value.downforce === 'lb' ? 0 : 1)
  },
  {
    key: 'power',
    label: 'WHEEL POWER',
    unit: unitLabel.power,
    height: 108,
    max: () => Math.max(grid.value.maxPowerKw * 1.05, 1),
    fmt: v => format.power(v),
    axis: v => Math.round(dispPowerNum(v)).toString()
  },
  {
    key: 'rpm',
    label: 'ENGINE RPM',
    unit: 'rpm',
    height: 92,
    max: () => Math.max(Math.ceil(grid.value.maxRpm / 1000) * 1000, 1000),
    fmt: v => `${Math.round(v)} rpm`,
    axis: v => (v / 1000).toFixed(1) + 'k'
  }
]

// Force needs torque; drop that panel when the feed doesn't carry it.
const panels = computed<Panel[]>(() =>
  grid.value.hasForce ? allPanels : allPanels.filter(p => p.key !== 'force')
)

const isEmpty = computed(() => grid.value.series.length === 0 || grid.value.speedsKmh.length === 0)

// --- uPlot lifecycle ------------------------------------------------------
const plotEls = ref<HTMLDivElement[]>([])
const plots: uPlot[] = []
let resizeObs: ResizeObserver | null = null
const cursorIdx = ref<number | null>(null)

function buildData(key: PanelKey): uPlot.AlignedData {
  const g = grid.value
  const series = g.series.map(s => s[key])
  return [g.speedsKmh, ...series] as unknown as uPlot.AlignedData
}

function buildOpts(panel: Panel, isLast: boolean, width: number): uPlot.Options {
  const series: uPlot.Series[] = [
    { label: 'speed' },
    ...grid.value.series.map(s => ({
      label: String(s.gear),
      stroke: gearColor(s.gear),
      width: 1.7,
      points: { show: false }
    }))
  ]
  return {
    width,
    height: panel.height,
    pxAlign: 0,
    legend: { show: false },
    cursor: {
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
        values: (_u, vals) => vals.map(v => Math.round(dispSpeed(v)).toString())
      },
      {
        stroke: '#71717a',
        grid: { stroke: '#27272a', width: 0.5 },
        ticks: { stroke: '#27272a', width: 0.5, size: 4 },
        font: '9px monospace',
        size: 40,
        values: (_u, vals) => vals.map(v => panel.axis(v))
      }
    ],
    scales: {
      x: { time: false },
      y: { range: () => [0, panel.max()] }
    },
    series,
    hooks: {
      setCursor: [
        (u: uPlot) => {
          const idx = u.cursor.idx
          cursorIdx.value = (idx === undefined || idx === null) ? null : idx
        }
      ]
    }
  }
}

function renderPlots(): void {
  destroyPlots()
  if (isEmpty.value) return
  const list = panels.value
  for (let i = 0; i < list.length; i++) {
    const panel = list[i]!
    const el = plotEls.value[i]
    if (!el) continue
    const w = el.clientWidth || 1000
    plots[i] = new uPlot(buildOpts(panel, i === list.length - 1, w), buildData(panel.key), el)
  }
}

function destroyPlots(): void {
  for (const p of plots) p?.destroy()
  plots.length = 0
}

// Structure fingerprint — when it changes the plots must be rebuilt; otherwise a
// cheap setData keeps the live curve flowing without tearing down the canvases.
function structureKey(): string {
  const g = grid.value
  return `${g.hasForce}|${g.speedsKmh.length}|${g.series.map(s => s.gear).join(',')}`
}
let lastStructure = ''

function syncPlots(): void {
  const key = structureKey()
  if (key !== lastStructure || plots.length !== panels.value.length) {
    lastStructure = key
    nextTick(() => renderPlots())
    return
  }
  const list = panels.value
  for (let i = 0; i < list.length; i++) plots[i]?.setData(buildData(list[i]!.key))
}

function resetZoom(): void {
  if (isEmpty.value) return
  const xs = grid.value.speedsKmh
  const min = xs[0] ?? 0
  const max = xs[xs.length - 1] ?? 0
  for (const p of plots) p?.setScale('x', { min, max })
}

onMounted(() => {
  lastStructure = structureKey()
  renderPlots()
  resizeObs = new ResizeObserver(() => {
    const list = panels.value
    for (let i = 0; i < plots.length; i++) {
      const p = plots[i]
      const el = plotEls.value[i]
      const panel = list[i]
      if (!p || !el || !panel) continue
      const w = el.clientWidth
      if (w > 0) p.setSize({ width: w, height: panel.height })
    }
  })
  for (const el of plotEls.value) resizeObs.observe(el)
})

onBeforeUnmount(() => {
  resizeObs?.disconnect()
  destroyPlots()
})

// Recompute the grid + push to the plots at most ~3×/s while driving.
watchThrottled(
  () => [props.dyno, props.model] as const,
  () => {
    grid.value = buildGearingGrid(props.dyno, props.model)
    syncPlots()
  },
  { throttle: 300 }
)

// Unit-preference changes don't alter data, only labels — redraw to reformat.
watch(
  () => [prefs.value.speed, prefs.value.power, prefs.value.downforce],
  () => {
    for (const p of plots) p?.redraw()
  }
)

// --- hover legend ---------------------------------------------------------
interface HoverGear {
  gear: number
  color: string
  force: number | null
  power: number | null
  rpm: number | null
}
const hover = computed<{ speedKmh: number, gears: HoverGear[] } | null>(() => {
  const i = cursorIdx.value
  const g = grid.value
  if (i === null || i < 0 || i >= g.speedsKmh.length) return null
  return {
    speedKmh: g.speedsKmh[i]!,
    gears: g.series.map(s => ({
      gear: s.gear,
      color: gearColor(s.gear),
      force: s.force[i] ?? null,
      power: s.power[i] ?? null,
      rpm: s.rpm[i] ?? null
    }))
  }
})

function hoverValue(panel: Panel, hg: HoverGear): string | null {
  const v = hg[panel.key]
  return v === null ? null : panel.fmt(v)
}

const radiusNote = computed(() => {
  if (props.model.tireRadiusM === null) return 'radius est. pending'
  return `tire r ≈ ${(props.model.tireRadiusM * 100).toFixed(1)} cm`
})
</script>

<template>
  <section class="panel p-4 font-mono text-zinc-100 backdrop-blur">
    <header class="mb-3 flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
      <span class="flex items-center gap-3">
        <span>
          {{ title }}
          <span
            v-if="subtitle"
            class="ml-2 normal-case tracking-normal text-zinc-500"
          >{{ subtitle }}</span>
        </span>
        <span class="normal-case tracking-normal text-zinc-500">{{ radiusNote }}</span>
        <span
          v-if="hover"
          class="rounded bg-zinc-800/80 px-1.5 py-0.5 normal-case tracking-normal text-zinc-200 tabular-nums"
        >@ {{ format.speed(hover.speedKmh) }}</span>
        <button
          v-if="!isEmpty"
          type="button"
          class="rounded border border-zinc-700 px-1.5 py-0.5 normal-case tracking-normal text-zinc-300 hover:bg-zinc-800"
          title="Reset zoom (or double-click any panel)"
          @click="resetZoom"
        >reset zoom</button>
      </span>
      <!-- Gear color legend -->
      <span class="flex flex-wrap items-center gap-x-3 gap-y-1 normal-case tracking-normal">
        <span
          v-for="s in grid.series"
          :key="s.gear"
          class="flex items-center gap-1"
        >
          <span
            class="inline-block h-1.5 w-3"
            :style="{ background: gearColor(s.gear) }"
          />
          <span class="text-zinc-400">gear {{ s.gear }}</span>
        </span>
      </span>
    </header>

    <div
      v-if="isEmpty"
      class="flex h-56 items-center justify-center rounded-md border border-dashed border-zinc-800 bg-zinc-900/30 text-center font-mono text-xs text-zinc-500"
    >
      Pull through every gear at full throttle — each gear's curves appear once
      its ratio is measured and the dyno has torque/power at that speed.
    </div>

    <div
      v-else
      class="space-y-0.5"
    >
      <div
        v-for="(panel, i) in panels"
        :key="panel.key"
        class="relative"
      >
        <span class="pointer-events-none absolute left-1 top-1 z-10 text-[9px] uppercase tracking-[0.2em] text-zinc-500">
          {{ panel.label }} · {{ panel.unit }}
        </span>
        <span
          v-if="hover"
          class="pointer-events-none absolute right-1 top-1 z-10 flex flex-wrap justify-end gap-1 text-[10px] tabular-nums"
        >
          <template
            v-for="hg in hover.gears"
            :key="hg.gear"
          >
            <span
              v-if="hoverValue(panel, hg) !== null"
              class="rounded px-1.5 py-0.5"
              :style="{ background: hg.color + '20', color: hg.color }"
            >{{ hoverValue(panel, hg) }}</span>
          </template>
        </span>
        <div
          ref="plotEls"
          class="gearing-plot w-full"
          :style="{ height: (i === panels.length - 1 ? panel.height + 22 : panel.height) + 'px' }"
        />
      </div>
    </div>

    <p class="mt-3 text-[11px] leading-relaxed text-zinc-500">
      All three panels share the speed axis — hover anywhere to read each gear's
      force, wheel power and engine RPM at that speed. Where a force curve drops
      below the next gear's, the gears trade places; a power dip between curves
      is engine speed falling out of the band across that ratio step.
    </p>
  </section>
</template>

<style scoped>
.gearing-plot :deep(.u-legend) {
  display: none;
}
.gearing-plot :deep(.u-select) {
  background: rgba(34, 211, 238, 0.12);
  border: 1px solid rgba(34, 211, 238, 0.4);
}
.gearing-plot :deep(.u-cursor-x),
.gearing-plot :deep(.u-cursor-y) {
  border-color: rgba(250, 250, 250, 0.5);
}
</style>
