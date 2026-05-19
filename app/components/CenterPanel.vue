<script setup lang="ts">
import { gearLabel } from '~/utils/tuning'

const props = defineProps<{
  rpm: number
  rpmMax: number
  rpmIdle: number
  gear: number
  speedKmh: number
  throttle: number
  brake: number
  steer: number
  boost: number
}>()

const rpmPct = computed(() => {
  if (props.rpmMax <= 0) return 0
  return Math.min(100, Math.max(0, (props.rpm / props.rpmMax) * 100))
})

// Redline shading from ~85% upwards
const rpmRedlinePct = computed(() => {
  if (props.rpmMax <= 0) return 100
  return Math.max(0, Math.min(100, ((props.rpmMax * 0.85) / props.rpmMax) * 100))
})

const rpmBarColor = computed(() => {
  const r = props.rpm / Math.max(props.rpmMax, 1)
  if (r > 0.95) return '#ef4444'
  if (r > 0.85) return '#f59e0b'
  return '#22c55e'
})

const steerPct = computed(() => (props.steer + 1) * 50)
</script>

<template>
  <div class="flex h-full flex-col items-stretch justify-between rounded-lg border border-zinc-800 bg-zinc-900/80 p-5 font-mono text-zinc-100 backdrop-blur">
    <!-- Top: gear + speed -->
    <div class="flex items-start justify-between">
      <div>
        <div class="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
          GEAR
        </div>
        <div class="text-7xl leading-none font-light tabular-nums">
          {{ gearLabel(gear) }}
        </div>
      </div>
      <div class="text-right">
        <div class="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
          KM/H
        </div>
        <div class="text-5xl leading-none font-light tabular-nums">
          {{ Math.round(speedKmh) }}
        </div>
      </div>
    </div>

    <!-- Middle: RPM linear bar -->
    <div class="mt-5">
      <div class="flex justify-between text-[10px] text-zinc-400">
        <span>RPM</span>
        <span class="tabular-nums">{{ Math.round(rpm) }} / {{ Math.round(rpmMax) }}</span>
      </div>
      <svg
        viewBox="0 0 100 10"
        class="mt-1 w-full"
        preserveAspectRatio="none"
      >
        <rect
          x="0"
          y="0"
          width="100"
          height="10"
          rx="1"
          fill="#27272a"
        />
        <!-- redline zone shading -->
        <rect
          :x="rpmRedlinePct"
          y="0"
          :width="100 - rpmRedlinePct"
          height="10"
          fill="#7f1d1d"
          opacity="0.4"
        />
        <!-- current rpm -->
        <rect
          x="0"
          y="0"
          :width="rpmPct"
          height="10"
          rx="1"
          :fill="rpmBarColor"
        />
        <!-- 85% tick -->
        <line
          :x1="rpmRedlinePct"
          y1="0"
          :x2="rpmRedlinePct"
          y2="10"
          stroke="#52525b"
          stroke-width="0.5"
        />
      </svg>
    </div>

    <!-- Inputs strip -->
    <div class="mt-5 space-y-2">
      <div class="flex items-center gap-2 text-[10px] text-zinc-400">
        <span class="w-12">THROTL</span>
        <div class="h-2 flex-1 overflow-hidden rounded bg-zinc-800">
          <div
            class="h-full bg-green-500"
            :style="{ width: (throttle * 100) + '%' }"
          />
        </div>
        <span class="w-8 text-right tabular-nums text-zinc-300">{{ Math.round(throttle * 100) }}</span>
      </div>
      <div class="flex items-center gap-2 text-[10px] text-zinc-400">
        <span class="w-12">BRAKE</span>
        <div class="h-2 flex-1 overflow-hidden rounded bg-zinc-800">
          <div
            class="h-full bg-red-500"
            :style="{ width: (brake * 100) + '%' }"
          />
        </div>
        <span class="w-8 text-right tabular-nums text-zinc-300">{{ Math.round(brake * 100) }}</span>
      </div>
      <div class="flex items-center gap-2 text-[10px] text-zinc-400">
        <span class="w-12">STEER</span>
        <div class="relative h-2 flex-1 overflow-hidden rounded bg-zinc-800">
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
        <span class="w-8 text-right tabular-nums text-zinc-300">{{ Math.round(steerPct - 50) }}</span>
      </div>
    </div>

    <div class="mt-5 flex justify-between text-[10px] uppercase tracking-wider text-zinc-500">
      <span>BOOST <span class="tabular-nums text-zinc-300">{{ boost.toFixed(2) }}</span></span>
      <span>IDLE <span class="tabular-nums text-zinc-300">{{ Math.round(rpmIdle) }}</span></span>
    </div>
  </div>
</template>
