<script setup lang="ts">
import { suspColor, tempColor, slipColor, SUSPENSION_BOTTOMING } from '~/utils/tuning'

const props = defineProps<{
  label: string
  side: 'left' | 'right'
  suspension: number
  slipRatio: number
  slipAngle: number
  tempC: number
  rumble: boolean
}>()

const bottoming = computed(() => props.suspension > SUSPENSION_BOTTOMING)
const susp = computed(() => suspColor(props.suspension))
const temp = computed(() => tempColor(props.tempC))
const ratioColor = computed(() => slipColor(Math.abs(props.slipRatio)))
const angleColor = computed(() => slipColor(Math.abs(props.slipAngle)))
const align = computed(() => props.side === 'left' ? 'text-left' : 'text-right')
</script>

<template>
  <div class="rounded-lg border border-zinc-800 bg-zinc-900/80 p-4 font-mono text-zinc-100 backdrop-blur">
    <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-zinc-400">
      <span>{{ label }}</span>
      <span
        v-if="rumble"
        class="rounded-sm bg-amber-400/20 px-1.5 py-0.5 text-amber-300"
      >RUMBLE</span>
    </div>

    <!-- Suspension bar -->
    <div class="mt-3">
      <div class="flex items-center justify-between text-[11px] text-zinc-400">
        <span>SUSP</span>
        <span class="text-zinc-200">{{ suspension.toFixed(2) }}</span>
      </div>
      <svg
        viewBox="0 0 100 6"
        class="mt-1 w-full"
        preserveAspectRatio="none"
      >
        <rect
          x="0"
          y="0"
          width="100"
          height="6"
          rx="1"
          fill="#27272a"
        />
        <rect
          x="0"
          y="0"
          :width="Math.min(suspension * 100, 100)"
          height="6"
          rx="1"
          :fill="susp"
          :class="{ 'animate-pulse': bottoming }"
        />
        <line
          x1="95"
          y1="0"
          x2="95"
          y2="6"
          stroke="#71717a"
          stroke-width="0.5"
          stroke-dasharray="1,1"
        />
      </svg>
    </div>

    <!-- Slip ratio + angle -->
    <div class="mt-4 grid grid-cols-2 gap-3 text-[11px]">
      <div :class="align">
        <div class="text-zinc-400">
          SLIP R
        </div>
        <div
          class="text-lg leading-none"
          :style="{ color: ratioColor }"
        >
          {{ slipRatio >= 0 ? '+' : '' }}{{ slipRatio.toFixed(2) }}
        </div>
      </div>
      <div :class="align">
        <div class="text-zinc-400">
          SLIP A
        </div>
        <div
          class="text-lg leading-none"
          :style="{ color: angleColor }"
        >
          {{ slipAngle >= 0 ? '+' : '' }}{{ slipAngle.toFixed(2) }}
        </div>
      </div>
    </div>

    <!-- Tire temp -->
    <div class="mt-4 flex items-center gap-2">
      <span
        class="inline-block h-3 w-3 rounded-sm"
        :style="{ background: temp }"
      />
      <span class="text-sm">{{ tempC.toFixed(0) }}<span class="text-zinc-500 text-[10px]">°C</span></span>
      <span class="ml-auto text-[10px] uppercase tracking-wider text-zinc-500">TIRE</span>
    </div>
  </div>
</template>
