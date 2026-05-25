<script setup lang="ts">
import type { DamperHistogram } from '~/utils/damper-velocity'

const props = withDefaults(defineProps<{
  histograms: {
    fl: DamperHistogram
    fr: DamperHistogram
    rl: DamperHistogram
    rr: DamperHistogram
  } | null
  title?: string
  subtitle?: string
}>(), {
  title: 'damper velocity',
  subtitle: ''
})

// Pro-tool reference: ideal cone peaks at ~12 % at 0 mm/s. We draw a faint
// dashed line at that height so the player can see at a glance whether the
// peak is near, above, or well below the reference.
const TARGET_PCT = 0.12

// Bar colors by velocity zone — values that fall further from zero
// indicate harder damper work; the eye picks out outliers without text.
const COLOR_NEAR_ZERO = '#e4e4e7' // zinc-200 — slow zone, where the cone should sit
const COLOR_MEDIUM = '#fbbf24' // amber-400 — 25..50 mm/s
const COLOR_FAST = '#f97316' // orange-500 — outside ±50 mm/s
const COLOR_TARGET = '#52525b' // zinc-600 — 12% reference dashes
const COLOR_ZERO_LINE = '#3f3f46' // zinc-700 — vertical 0 mm/s divider

function colorForBin(leftEdge: number, rightEdge: number): string {
  const mid = (leftEdge + rightEdge) / 2
  const abs = Math.abs(mid)
  if (abs > 50) return COLOR_FAST
  if (abs > 25) return COLOR_MEDIUM
  return COLOR_NEAR_ZERO
}

// Each cell: 280 × 140 viewBox. Padding leaves room for a target-line
// label on the right and a slim x-axis label row at the bottom.
const CELL_W = 280
const CELL_H = 140
const PAD_T = 12
const PAD_R = 30
const PAD_B = 20
const PAD_L = 14
const PLOT_W = CELL_W - PAD_L - PAD_R
const PLOT_H = CELL_H - PAD_T - PAD_B

interface Bar {
  x: number
  y: number
  w: number
  h: number
  color: string
  pct: number
  leftEdge: number
}

function barsFor(h: DamperHistogram): Bar[] {
  const out: Bar[] = []
  const total = h.totalSamples || 1
  const edges = h.binEdges
  const minE = edges[0]!
  const maxE = edges[edges.length - 1]!
  const span = maxE - minE
  // Auto-scale the Y axis to the tallest bar so smaller variations stay
  // visible; clamp the minimum so a near-flat histogram doesn't end up
  // looking like a wild ride.
  let maxPct = TARGET_PCT * 1.4
  for (const c of h.counts) {
    const pct = c / total
    if (pct > maxPct) maxPct = pct
  }
  for (let i = 0; i < h.counts.length; i++) {
    const lo = edges[i]!
    const hi = edges[i + 1]!
    const pct = h.counts[i]! / total
    const xL = PAD_L + ((lo - minE) / span) * PLOT_W
    const xR = PAD_L + ((hi - minE) / span) * PLOT_W
    const w = Math.max(1, xR - xL - 1)
    const barH = (pct / maxPct) * PLOT_H
    out.push({
      x: xL,
      y: PAD_T + PLOT_H - barH,
      w,
      h: barH,
      color: colorForBin(lo, hi),
      pct,
      leftEdge: lo
    })
  }
  return out
}

function targetLineY(h: DamperHistogram): number {
  const total = h.totalSamples || 1
  let maxPct = TARGET_PCT * 1.4
  for (const c of h.counts) {
    const pct = c / total
    if (pct > maxPct) maxPct = pct
  }
  return PAD_T + PLOT_H - (TARGET_PCT / maxPct) * PLOT_H
}

function zeroLineX(h: DamperHistogram): number {
  const edges = h.binEdges
  const minE = edges[0]!
  const maxE = edges[edges.length - 1]!
  return PAD_L + ((0 - minE) / (maxE - minE)) * PLOT_W
}

function pctFmt(p: number): string {
  return Math.round(p * 100) + '%'
}

interface Cell {
  key: 'fl' | 'fr' | 'rl' | 'rr'
  label: string
  histogram: DamperHistogram | null
}

const cells = computed<Cell[]>(() => {
  const h = props.histograms
  return [
    { key: 'fl', label: 'FL', histogram: h?.fl ?? null },
    { key: 'fr', label: 'FR', histogram: h?.fr ?? null },
    { key: 'rl', label: 'RL', histogram: h?.rl ?? null },
    { key: 'rr', label: 'RR', histogram: h?.rr ?? null }
  ]
})

const hasData = computed(() => props.histograms !== null)
</script>

<template>
  <section class="panel p-4 font-mono text-zinc-100 backdrop-blur">
    <header class="mb-3 flex items-baseline justify-between gap-3 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
      <span>
        {{ title }}
        <span
          v-if="subtitle"
          class="ml-3 normal-case tracking-normal text-zinc-500"
        >{{ subtitle }}</span>
      </span>
      <span class="flex items-center gap-3 normal-case tracking-normal text-zinc-500">
        <span class="flex items-center gap-1">
          <span
            class="inline-block h-2 w-2.5"
            :style="{ background: COLOR_NEAR_ZERO }"
          />slow
        </span>
        <span class="flex items-center gap-1">
          <span
            class="inline-block h-2 w-2.5"
            :style="{ background: COLOR_MEDIUM }"
          />medium
        </span>
        <span class="flex items-center gap-1">
          <span
            class="inline-block h-2 w-2.5"
            :style="{ background: COLOR_FAST }"
          />fast
        </span>
      </span>
    </header>

    <div
      v-if="!hasData"
      class="flex h-40 items-center justify-center rounded-md border border-dashed border-zinc-800 bg-zinc-900/30 text-xs text-zinc-500"
    >
      Not enough samples in this lap.
    </div>

    <div
      v-else
      class="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      <div
        v-for="cell in cells"
        :key="cell.key"
        class="rounded-md border border-zinc-800/80 bg-zinc-950/40 p-2"
      >
        <div class="mb-1 flex items-baseline justify-between text-[10px] uppercase tracking-[0.2em]">
          <span class="text-zinc-400">{{ cell.label }}</span>
          <span
            v-if="cell.histogram"
            class="normal-case tracking-normal text-zinc-500 tabular-nums"
            :title="'Peak bin time-share — pro target ≈ 12 %'"
          >peak {{ pctFmt(cell.histogram.peakPct) }}</span>
        </div>

        <svg
          v-if="cell.histogram"
          :viewBox="`0 0 ${CELL_W} ${CELL_H}`"
          preserveAspectRatio="xMidYMid meet"
          class="block w-full"
        >
          <!-- Histogram bars -->
          <rect
            v-for="(b, i) in barsFor(cell.histogram)"
            :key="i"
            :x="b.x"
            :y="b.y"
            :width="b.w"
            :height="b.h"
            :fill="b.color"
            opacity="0.85"
          />

          <!-- 12 % target dashed line -->
          <line
            :x1="PAD_L"
            :y1="targetLineY(cell.histogram)"
            :x2="CELL_W - PAD_R"
            :y2="targetLineY(cell.histogram)"
            :stroke="COLOR_TARGET"
            stroke-width="0.6"
            stroke-dasharray="3,3"
          />
          <text
            :x="CELL_W - PAD_R + 2"
            :y="targetLineY(cell.histogram) + 3"
            font-size="8"
            font-family="monospace"
            :fill="COLOR_TARGET"
          >12%</text>

          <!-- 0 mm/s divider -->
          <line
            :x1="zeroLineX(cell.histogram)"
            :y1="PAD_T"
            :x2="zeroLineX(cell.histogram)"
            :y2="PAD_T + PLOT_H"
            :stroke="COLOR_ZERO_LINE"
            stroke-width="0.7"
          />

          <!-- x-axis labels: −250 / 0 / +250 mm/s -->
          <text
            :x="PAD_L"
            :y="PAD_T + PLOT_H + 12"
            font-size="8"
            font-family="monospace"
            fill="#52525b"
          >−250</text>
          <text
            :x="zeroLineX(cell.histogram)"
            :y="PAD_T + PLOT_H + 12"
            font-size="8"
            font-family="monospace"
            fill="#52525b"
            text-anchor="middle"
          >0</text>
          <text
            :x="CELL_W - PAD_R"
            :y="PAD_T + PLOT_H + 12"
            font-size="8"
            font-family="monospace"
            fill="#52525b"
            text-anchor="end"
          >+250 mm/s</text>
        </svg>

        <!-- Zone time-share readout -->
        <div
          v-if="cell.histogram"
          class="mt-1 grid grid-cols-4 gap-1 text-center text-[9px] uppercase tracking-[0.1em] text-zinc-500"
        >
          <div>
            <div>F·reb</div>
            <div class="text-zinc-300 tabular-nums">
              {{ pctFmt(cell.histogram.fastReboundPct) }}
            </div>
          </div>
          <div>
            <div>S·reb</div>
            <div class="text-zinc-300 tabular-nums">
              {{ pctFmt(cell.histogram.slowReboundPct) }}
            </div>
          </div>
          <div>
            <div>S·bump</div>
            <div class="text-zinc-300 tabular-nums">
              {{ pctFmt(cell.histogram.slowBumpPct) }}
            </div>
          </div>
          <div>
            <div>F·bump</div>
            <div class="text-zinc-300 tabular-nums">
              {{ pctFmt(cell.histogram.fastBumpPct) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
