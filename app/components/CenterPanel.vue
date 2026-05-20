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
  /** body-frame longitudinal acceleration (m/s²) — +ve forward */
  accelLong: number
  /** body-frame lateral acceleration (m/s²) — +ve to one side */
  accelLat: number
  /** chassis roll in radians */
  roll: number
  /** chassis pitch in radians */
  pitch: number
  /** yaw rate, rad/s — sign matches steer direction */
  yawRate: number
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

// --- G-G dot ---------------------------------------------------------------
// 2g range on each axis. Convention: lateral on X, longitudinal on Y with
// braking UP (negative accelLong = upper half).
const G_RANGE_MPS2 = 20 // ≈ 2g
const TRAIL_SAMPLES = 60 // ~1 second of 60 Hz history

interface GPoint { x: number, y: number }
const trail = ref<GPoint[]>([])

function ggDot(): GPoint {
  const xs = 50 + clamp(props.accelLat / G_RANGE_MPS2, -1, 1) * 48
  // Braking (negative accelLong) plots toward the top of the SVG.
  const ys = 50 - clamp(props.accelLong / G_RANGE_MPS2, -1, 1) * 48
  return { x: xs, y: ys }
}

watch(() => [props.accelLat, props.accelLong] as const, () => {
  trail.value.push(ggDot())
  if (trail.value.length > TRAIL_SAMPLES) trail.value.shift()
}, { immediate: true })

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

const dotPos = computed<GPoint>(() => ggDot())

const trailPath = computed(() => {
  const pts = trail.value
  if (pts.length < 2) return ''
  let out = ''
  for (let i = 0; i < pts.length; i++) {
    out += (i === 0 ? 'M' : 'L') + pts[i]!.x.toFixed(1) + ',' + pts[i]!.y.toFixed(1) + ' '
  }
  return out.trim()
})

const lateralG = computed(() => props.accelLat / 9.81)
const longG = computed(() => props.accelLong / 9.81)
const radToDeg = (rad: number): number => rad * 57.2957795

function signedFixed(v: number, digits: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(digits)
}
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

    <!-- Chassis strip: G-G dot + attitude/rotation readouts -->
    <div class="mt-5 flex items-stretch gap-4">
      <!-- G-G dot -->
      <div class="relative shrink-0">
        <svg
          viewBox="0 0 100 100"
          class="h-24 w-24"
        >
          <!-- backdrop -->
          <circle
            cx="50"
            cy="50"
            r="48"
            fill="#18181b"
            stroke="#27272a"
            stroke-width="0.5"
          />
          <!-- crosshair -->
          <line
            x1="50"
            y1="2"
            x2="50"
            y2="98"
            stroke="#3f3f46"
            stroke-width="0.4"
          />
          <line
            x1="2"
            y1="50"
            x2="98"
            y2="50"
            stroke="#3f3f46"
            stroke-width="0.4"
          />
          <!-- 1g ring -->
          <circle
            cx="50"
            cy="50"
            r="24"
            fill="none"
            stroke="#3f3f46"
            stroke-width="0.4"
            stroke-dasharray="2,2"
          />
          <!-- trail of the last ~1 s -->
          <path
            :d="trailPath"
            fill="none"
            stroke="#f59e0b"
            stroke-width="0.8"
            stroke-linejoin="round"
            stroke-linecap="round"
            opacity="0.55"
          />
          <!-- current point -->
          <circle
            :cx="dotPos.x"
            :cy="dotPos.y"
            r="2.4"
            fill="#22c55e"
          />
        </svg>
        <div class="absolute top-0.5 left-1 text-[8px] uppercase tracking-wider text-zinc-600">
          G-G
        </div>
        <div class="absolute right-1 bottom-0.5 text-[8px] tabular-nums text-zinc-500">
          {{ signedFixed(lateralG, 1) }}·{{ signedFixed(longG, 1) }}g
        </div>
      </div>

      <!-- Attitude + rotation readouts -->
      <div class="grid flex-1 grid-cols-2 gap-x-3 gap-y-1.5 self-center text-[10px]">
        <div class="flex items-center justify-between text-zinc-400">
          <span>ROLL</span>
          <span class="tabular-nums text-zinc-200">{{ signedFixed(radToDeg(roll), 1) }}°</span>
        </div>
        <div class="flex items-center justify-between text-zinc-400">
          <span>PITCH</span>
          <span class="tabular-nums text-zinc-200">{{ signedFixed(radToDeg(pitch), 1) }}°</span>
        </div>
        <div class="flex items-center justify-between text-zinc-400">
          <span>YAW/s</span>
          <span class="tabular-nums text-zinc-200">{{ signedFixed(yawRate, 2) }}</span>
        </div>
        <div class="flex items-center justify-between text-zinc-400">
          <span>BOOST</span>
          <span class="tabular-nums text-zinc-200">{{ boost.toFixed(2) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
