<script setup lang="ts">
const { prefs: displayPrefs } = useDisplayPrefs()

defineProps<{
  rpm: number
  rpmMax: number
  rpmIdle: number
  gear: number
  speedKmh: number
  boost: number
  /** whether the car produces boost (forced induction) — hides the boost gauge on NA cars */
  hasBoost: boolean
}>()
</script>

<template>
  <div class="panel p-3 font-mono text-zinc-100 backdrop-blur sm:p-5">
    <!-- Instrument cluster (gauges) only. Inputs and attitude/power readouts
         now live in CornerView's center column, above the G-G dot. -->
    <ClusterTwinDial
      v-if="displayPrefs.cluster === 'twin'"
      :rpm="rpm"
      :rpm-max="rpmMax"
      :gear="gear"
      :speed-kmh="speedKmh"
      :boost="boost"
      :has-boost="hasBoost"
    />
    <ClusterDigitalArc
      v-else
      :rpm="rpm"
      :rpm-max="rpmMax"
      :gear="gear"
      :speed-kmh="speedKmh"
      :boost="boost"
      :has-boost="hasBoost"
    />
  </div>
</template>
