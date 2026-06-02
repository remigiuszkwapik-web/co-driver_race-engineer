<script setup lang="ts">
import { polar, arcPath } from '~/utils/gauge'

// A little steering-wheel sim: the rim + spokes rotate with the steering input,
// and a top arc echoes the angle so you can read lock direction at a glance.
// Parent feeds the normalized steer channel (-1 = full left, +1 = full right).
const props = withDefaults(defineProps<{
  /** Steering input, -1..1. */
  steer: number
  /** Wheel rotation at full lock, degrees. */
  maxDeg?: number
  accent?: string
  label?: string
  /** Draw the round instrument backing so it sits beside the dials. */
  background?: boolean
}>(), {
  maxDeg: 180,
  accent: '#22c55e',
  label: 'STEER',
  background: true
})

// Arc half-span: the top track runs from -SPAN (left) to +SPAN (right).
const SPAN = 110
const AR = 84
const RIM = 46

const clamped = computed(() => props.steer < -1 ? -1 : props.steer > 1 ? 1 : props.steer)
const rot = computed(() => clamped.value * props.maxDeg)

const trackPath = arcPath(100, 100, AR, -SPAN, SPAN)
const fillPath = computed(() => {
  const pos = clamped.value * SPAN
  return clamped.value >= 0 ? arcPath(100, 100, AR, 0, pos) : arcPath(100, 100, AR, pos, 0)
})
const marker = computed(() => polar(100, 100, AR, clamped.value * SPAN))

const topTickA = polar(100, 100, AR + 5, 0)
const topTickB = polar(100, 100, AR - 5, 0)
const lLabel = polar(100, 100, AR - 13, -SPAN)
const rLabel = polar(100, 100, AR - 13, SPAN)

// Horizontal spoke endpoints (9 → 3 o'clock) and the bottom spoke tip.
const spokeL = polar(100, 100, RIM, -90)
const spokeR = polar(100, 100, RIM, 90)
const spokeB = polar(100, 100, RIM, 180)
const rimMark = arcPath(100, 100, RIM, -15, 15)

const valueStr = computed(() => (clamped.value >= 0 ? '+' : '') + Math.round(clamped.value * 100))
</script>

<template>
  <svg
    viewBox="0 0 200 200"
    class="aspect-square w-full"
  >
    <circle
      v-if="background"
      cx="100"
      cy="100"
      r="96"
      fill="#0f0f12"
      stroke="#27272a"
      stroke-width="1"
    />
    <!-- angle track -->
    <path
      :d="trackPath"
      fill="none"
      stroke="#3f3f46"
      stroke-width="3"
      stroke-linecap="round"
    />
    <path
      v-if="fillPath"
      :d="fillPath"
      fill="none"
      :stroke="accent"
      stroke-width="3"
      stroke-linecap="round"
    />
    <line
      :x1="topTickA.x"
      :y1="topTickA.y"
      :x2="topTickB.x"
      :y2="topTickB.y"
      stroke="#71717a"
      stroke-width="1"
    />
    <circle
      :cx="marker.x"
      :cy="marker.y"
      r="4"
      :fill="accent"
    />
    <text
      :x="lLabel.x"
      :y="lLabel.y"
      text-anchor="middle"
      dominant-baseline="central"
      fill="#a1a1aa"
      font-size="9"
      font-family="monospace"
    >L</text>
    <text
      :x="rLabel.x"
      :y="rLabel.y"
      text-anchor="middle"
      dominant-baseline="central"
      fill="#a1a1aa"
      font-size="9"
      font-family="monospace"
    >R</text>
    <!-- the wheel itself, rotated by the steering input -->
    <g :transform="`rotate(${rot} 100 100)`">
      <circle
        cx="100"
        cy="100"
        :r="RIM"
        fill="none"
        stroke="#52525b"
        stroke-width="5"
      />
      <path
        :d="rimMark"
        fill="none"
        :stroke="accent"
        stroke-width="6"
        stroke-linecap="round"
      />
      <line
        :x1="spokeL.x"
        :y1="spokeL.y"
        :x2="spokeR.x"
        :y2="spokeR.y"
        stroke="#52525b"
        stroke-width="5"
        stroke-linecap="round"
      />
      <line
        x1="100"
        y1="100"
        :x2="spokeB.x"
        :y2="spokeB.y"
        stroke="#52525b"
        stroke-width="5"
        stroke-linecap="round"
      />
    </g>
    <!-- static hub + readout on top, so the number never spins -->
    <circle
      cx="100"
      cy="100"
      r="16"
      fill="#0f0f12"
      :stroke="accent"
      stroke-width="1.6"
    />
    <text
      x="100"
      y="100"
      text-anchor="middle"
      dominant-baseline="central"
      fill="#fafafa"
      font-size="13"
      font-family="monospace"
    >{{ valueStr }}</text>
    <text
      x="100"
      y="190"
      text-anchor="middle"
      fill="#71717a"
      font-size="9"
      font-family="monospace"
      letter-spacing="1.5"
    >{{ label }}</text>
  </svg>
</template>
