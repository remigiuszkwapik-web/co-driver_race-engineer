<script setup lang="ts">
const { format } = useUnits()

const props = defineProps<{
  throttle: number
  brake: number
  steer: number
  /** chassis roll in radians */
  roll: number
  /** chassis pitch in radians */
  pitch: number
  /** yaw rate, rad/s — sign matches steer direction */
  yawRate: number
  /** engine power from telemetry, in watts */
  power: number
}>()

const steerPct = computed(() => (props.steer + 1) * 50)

const radToDeg = (rad: number): number => rad * 57.2957795

function signedFixed(v: number, digits: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(digits)
}
</script>

<template>
  <div class="flex flex-col gap-3 font-mono text-zinc-100">
    <!-- Inputs strip -->
    <div class="space-y-2.5">
      <div class="flex items-center gap-2 text-sm text-zinc-400">
        <span class="w-16">THROTL</span>
        <div class="h-2.5 flex-1 overflow-hidden rounded bg-zinc-800">
          <div
            class="h-full bg-green-500"
            :style="{ width: (throttle * 100) + '%' }"
          />
        </div>
        <span class="w-10 text-right tabular-nums text-zinc-200">{{ Math.round(throttle * 100) }}</span>
      </div>
      <div class="flex items-center gap-2 text-sm text-zinc-400">
        <NuxtLink
          to="/tune/brakes"
          class="group inline-flex w-16 items-center gap-1 transition-colors hover:text-green-300"
        >
          <span>BRAKE</span>
          <UIcon
            name="i-lucide-arrow-up-right"
            class="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-70"
          />
        </NuxtLink>
        <div class="h-2.5 flex-1 overflow-hidden rounded bg-zinc-800">
          <div
            class="h-full bg-red-500"
            :style="{ width: (brake * 100) + '%' }"
          />
        </div>
        <span class="w-10 text-right tabular-nums text-zinc-200">{{ Math.round(brake * 100) }}</span>
      </div>
      <div class="flex items-center gap-2 text-sm text-zinc-400">
        <span class="w-16">STEER</span>
        <div class="relative h-2.5 flex-1 overflow-hidden rounded bg-zinc-800">
          <div
            class="absolute top-0 h-full w-px bg-zinc-600"
            style="left: 50%;"
          />
          <div
            class="absolute top-0 h-full bg-amber-400"
            :style="steer >= 0
              ? { left: '50%', width: (steer * 50) + '%' }
              : { right: '50%', width: (-steer * 50) + '%' }"
          />
        </div>
        <span class="w-10 text-right tabular-nums text-zinc-200">{{ Math.round(steerPct - 50) }}</span>
      </div>
    </div>

    <!-- Attitude + power readouts -->
    <div class="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-zinc-800 pt-3 text-sm">
      <div class="flex items-center justify-between text-zinc-400">
        <NuxtLink
          to="/tune/anti-roll-bars"
          class="group inline-flex items-center gap-1 transition-colors hover:text-green-300"
        >
          <span>ROLL</span>
          <UIcon
            name="i-lucide-arrow-up-right"
            class="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-70"
          />
        </NuxtLink>
        <span class="text-lg tabular-nums text-zinc-100">{{ signedFixed(radToDeg(roll), 1) }}°</span>
      </div>
      <div class="flex items-center justify-between text-zinc-400">
        <NuxtLink
          to="/tune/dampers"
          class="group inline-flex items-center gap-1 transition-colors hover:text-green-300"
        >
          <span>PITCH</span>
          <UIcon
            name="i-lucide-arrow-up-right"
            class="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-70"
          />
        </NuxtLink>
        <span class="text-lg tabular-nums text-zinc-100">{{ signedFixed(radToDeg(pitch), 1) }}°</span>
      </div>
      <div class="flex items-center justify-between text-zinc-400">
        <span>YAW/s</span>
        <span class="text-lg tabular-nums text-zinc-100">{{ signedFixed(yawRate, 2) }}</span>
      </div>
      <div class="flex items-center justify-between text-zinc-400">
        <span>POWER</span>
        <span class="text-lg tabular-nums text-zinc-100">{{ format.power(power / 1000) }}</span>
      </div>
    </div>
  </div>
</template>
