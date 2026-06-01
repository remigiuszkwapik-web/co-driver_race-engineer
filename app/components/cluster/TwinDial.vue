<script setup lang="ts">
import { gearLabel } from '~/utils/tuning'

// Analog cluster, dials sitting beside each other: boost · tach · gear ·
// speedo, left to right. Boost dial is hidden on NA cars (then tach leads).
const props = defineProps<{
  rpm: number
  rpmMax: number
  gear: number
  speedKmh: number
  /** Engine boost, gauge PSI relative to ambient (Forza native). */
  boost: number
  /** Whether to show the boost dial (hidden on NA cars). */
  hasBoost: boolean
}>()

const { prefs, unitLabel, toDisplay } = useUnits()

function rpmZone(rpm: number, max: number): string {
  const r = rpm / Math.max(max, 1)
  if (r > 0.95) return '#ef4444'
  if (r > 0.85) return '#f59e0b'
  return '#22c55e'
}

// --- tach ---
const rpmFrac = computed(() => props.rpmMax > 0 ? props.rpm / props.rpmMax : 0)
const rpmAccent = computed(() => rpmZone(props.rpm, props.rpmMax))
const rpmK = computed(() => (props.rpm / 1000).toFixed(1))
const tachTicks = computed(() => {
  const max = props.rpmMax > 0 ? props.rpmMax : 8000
  const out: { frac: number, label: string, accent?: boolean }[] = []
  const maxK = Math.floor(max / 1000)
  for (let i = 0; i <= maxK; i++) {
    const f = (i * 1000) / max
    out.push({ frac: f, label: String(i), accent: f >= 0.85 })
  }
  return out
})

// --- speedo ---
const speedDisplay = computed(() =>
  prefs.value.speed === 'mph' ? Math.round(props.speedKmh * 0.621371) : Math.round(props.speedKmh))
const speedMax = computed(() => prefs.value.speed === 'mph' ? 300 : 500)
const speedFrac = computed(() => speedDisplay.value / speedMax.value)
const speedTicks = computed(() => {
  const step = prefs.value.speed === 'mph' ? 60 : 100
  const out: { frac: number, label: string }[] = []
  for (let v = 0; v <= speedMax.value; v += step) {
    out.push({ frac: v / speedMax.value, label: String(v) })
  }
  return out
})

// --- boost (range -15..+30 psi; zero falls at one third of the sweep) ---
const BOOST_MIN = -15
const BOOST_MAX = 30
const boostFrac = computed(() => (props.boost - BOOST_MIN) / (BOOST_MAX - BOOST_MIN))
const boostValue = computed(() => String(toDisplay.boost(props.boost)))
const boostAccent = computed(() => props.boost > 0.1 ? '#22c55e' : '#71717a')
const boostTicks: { frac: number, label: string }[] = [
  { frac: 0, label: '' },
  { frac: 1 / 3, label: '0' },
  { frac: 2 / 3, label: '' },
  { frac: 1, label: '' }
]
</script>

<template>
  <div class="flex items-center justify-center gap-4 sm:gap-6">
    <div
      v-if="hasBoost"
      class="shrink-0"
      style="width: clamp(4.5rem, 13vw, 7rem);"
    >
      <ClusterDial
        :frac="boostFrac"
        :ticks="boostTicks"
        :accent="boostAccent"
        :value="boostValue"
        :unit="unitLabel.boost"
        label="BOOST"
      />
    </div>

    <NuxtLink
      to="/tune/gearing"
      class="block shrink-0 transition-opacity hover:opacity-90"
      style="width: clamp(7rem, 20vw, 12rem);"
    >
      <ClusterDial
        :frac="rpmFrac"
        :ticks="tachTicks"
        :accent="rpmAccent"
        :value="rpmK"
        unit="×1000"
        label="RPM"
        :redline-frac="0.85"
      />
    </NuxtLink>

    <NuxtLink
      to="/tune/gearing"
      class="group flex shrink-0 flex-col items-center"
    >
      <span class="text-[10px] uppercase tracking-[0.2em] text-zinc-500 transition-colors group-hover:text-green-300">GEAR</span>
      <span class="text-6xl leading-none font-light tabular-nums text-zinc-100 sm:text-7xl">{{ gearLabel(gear) }}</span>
    </NuxtLink>

    <div
      class="shrink-0"
      style="width: clamp(7rem, 20vw, 12rem);"
    >
      <ClusterDial
        :frac="speedFrac"
        :ticks="speedTicks"
        accent="#d4d4d8"
        :value="String(speedDisplay)"
        :unit="unitLabel.speed"
        label="SPEED"
      />
    </div>
  </div>
</template>
