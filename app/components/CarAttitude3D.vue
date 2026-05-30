<script setup lang="ts">
import { OrbitControls } from '@tresjs/cientos'
import type { Telemetry } from '../../server/utils/decode'

const props = defineProps<{
  frame: Telemetry | null
}>()

const DEG = Math.PI / 180
const HALF_PI = Math.PI / 2

// Dimensions in world units. Tuned for readability, not literal scale.
// Forward = +Z, up = +Y, right = +X (Three.js right-hand convention).
const CHASSIS_W = 1.7
const CHASSIS_H = 0.55
const CHASSIS_L = 4.2
const CABIN_W = CHASSIS_W * 0.78
const CABIN_H = 0.42
const CABIN_L = CHASSIS_L * 0.42
const WHEEL_RADIUS = 0.36
const WHEEL_WIDTH = 0.28
const TRACK = 0.85
const WHEELBASE = 1.4
const CHASSIS_Y = 1.35
const CABIN_Y = CHASSIS_Y + CHASSIS_H * 0.5 + 0.22
const CABIN_Z = -0.5
const BASE_WHEEL_Y = WHEEL_RADIUS
const VISIBLE_TRAVEL = 0.16

// Spring (coil-stack approximation)
const SPRING_RINGS = 7
const SPRING_RING_RADIUS = 0.10
const SPRING_TUBE_RADIUS = 0.018
const SPRING_ROTATION: [number, number, number] = [HALF_PI, 0, 0]

const STEER_LOCK_RAD = 35 * DEG
const YAW_CUE_GAIN = 1.2
const MAX_YAW_CUE = 10 * DEG

// Pre-rotated orientations for re-used axes.
const WHEEL_LAY_DOWN: [number, number, number] = [0, 0, HALF_PI]
const LONG_BODY_ROT: [number, number, number] = [HALF_PI, 0, 0]
const LONG_HEAD_FWD: [number, number, number] = [HALF_PI, 0, 0]
const LONG_HEAD_BWD: [number, number, number] = [-HALF_PI, 0, 0]
const LAT_BODY_ROT: [number, number, number] = [0, 0, HALF_PI]
const LAT_HEAD_RIGHT: [number, number, number] = [0, 0, -HALF_PI]
const LAT_HEAD_LEFT: [number, number, number] = [0, 0, HALF_PI]

// 1g → 0.5 world units of arrow length.
const ACCEL_SCALE = 0.5 / 9.81
const ARROW_MIN = 0.04 // keep arrows visible at idle as orientation indicators
const ARROW_HEAD_HALF = 0.07

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

// Chassis Euler rotation. Pitch around X, roll around Z. Yaw suppressed; a
// small derived cue from angularVelocity.y stands in so the body leans into a
// turn. Sign convention: pitch>0 = nose-up, roll>0 = right-lean (assumed
// aerospace per Forza convention — flip during visual verification if wrong).
const chassisRotation = computed<[number, number, number]>(() => {
  const f = props.frame
  if (!f) return [0, 0, 0]
  const pitch = -f.pitch
  const roll = f.roll
  const yawCue = clamp(f.angularVelocity.y * YAW_CUE_GAIN, -MAX_YAW_CUE, MAX_YAW_CUE)
  return [pitch, yawCue, roll]
})

const steerAngle = computed(() => (props.frame?.steer ?? 0) * STEER_LOCK_RAD)

// Forza suspension is 0..1 (0 = extended, 1 = compressed). Compressed wheel
// tucks up toward chassis; extended wheel drops.
function wheelY(susp: number): number {
  return BASE_WHEEL_Y - (1 - susp) * VISIBLE_TRAVEL
}

const flY = computed(() => wheelY(props.frame?.suspension.fl ?? 0.5))
const frY = computed(() => wheelY(props.frame?.suspension.fr ?? 0.5))
const rlY = computed(() => wheelY(props.frame?.suspension.rl ?? 0.5))
const rrY = computed(() => wheelY(props.frame?.suspension.rr ?? 0.5))

// Coil-spring approximation: stack of horizontal torus rings between the
// chassis attach point (just under chassis bottom) and the wheel hub. Ring
// spacing shrinks under compression, matching real coil behavior.
function springRingYs(wheelYVal: number): number[] {
  const yTop = CHASSIS_Y - CHASSIS_H * 0.5 - 0.02
  const yBot = wheelYVal + WHEEL_RADIUS * 0.65
  const len = Math.max(yTop - yBot, 0.04)
  const step = len / (SPRING_RINGS - 1)
  const ys: number[] = []
  for (let i = 0; i < SPRING_RINGS; i++) ys.push(yBot + i * step)
  return ys
}

const springFL = computed(() => springRingYs(flY.value))
const springFR = computed(() => springRingYs(frY.value))
const springRL = computed(() => springRingYs(rlY.value))
const springRR = computed(() => springRingYs(rrY.value))

// Acceleration vectors in chassis-local frame. accel.z = longitudinal,
// accel.x = lateral. Arrows tilt with chassis so they read as forces felt
// in the body frame.
const longAccZ = computed(() => props.frame?.acceleration.z ?? 0)
const longSign = computed(() => longAccZ.value >= 0 ? 1 : -1)
const longLen = computed(() => Math.max(Math.abs(longAccZ.value) * ACCEL_SCALE, ARROW_MIN))
const longColor = computed(() => longAccZ.value >= 0 ? '#22c55e' : '#ef4444')
const longHeadRot = computed(() => longSign.value > 0 ? LONG_HEAD_FWD : LONG_HEAD_BWD)
const longBodyPos = computed<[number, number, number]>(() => [0, 0, longSign.value * longLen.value * 0.5])
const longHeadPos = computed<[number, number, number]>(() => [0, 0, longSign.value * (longLen.value + ARROW_HEAD_HALF)])

const latAccX = computed(() => props.frame?.acceleration.x ?? 0)
const latSign = computed(() => latAccX.value >= 0 ? 1 : -1)
const latLen = computed(() => Math.max(Math.abs(latAccX.value) * ACCEL_SCALE, ARROW_MIN))
const latHeadRot = computed(() => latSign.value > 0 ? LAT_HEAD_RIGHT : LAT_HEAD_LEFT)
const latBodyPos = computed<[number, number, number]>(() => [latSign.value * latLen.value * 0.5, 0, 0])
const latHeadPos = computed<[number, number, number]>(() => [latSign.value * (latLen.value + ARROW_HEAD_HALF), 0, 0])
</script>

<template>
  <ClientOnly>
    <TresCanvas
      clear-color="#0a0a0c"
      class="!h-full !w-full"
    >
      <TresPerspectiveCamera
        :position="[4.5, 3.2, 5.5]"
        :fov="42"
      />
      <OrbitControls
        :enable-pan="false"
        :min-distance="3.5"
        :max-distance="14"
        :target="[0, 1.0, 0]"
      />

      <TresAmbientLight :intensity="0.7" />
      <TresDirectionalLight
        :position="[5, 8, 3]"
        :intensity="0.5"
      />

      <!-- Ground grid — spatial reference for the chassis attitude. -->
      <TresGridHelper :args="[20, 20, 0x3f3f46, 0x27272a]" />

      <!-- Car group: everything inside rotates by chassis attitude. -->
      <TresGroup :rotation="chassisRotation">
        <!-- Chassis frame: wireframe box (truss-like skeleton). -->
        <TresMesh :position="[0, CHASSIS_Y, 0]">
          <TresBoxGeometry :args="[CHASSIS_W, CHASSIS_H, CHASSIS_L]" />
          <TresMeshBasicMaterial
            color="#22c55e"
            :wireframe="true"
          />
        </TresMesh>

        <!-- Cabin: smaller wireframe box offset rearward — orientation cue
             (hood is the front). Brighter color to distinguish from chassis. -->
        <TresMesh :position="[0, CABIN_Y, CABIN_Z]">
          <TresBoxGeometry :args="[CABIN_W, CABIN_H, CABIN_L]" />
          <TresMeshBasicMaterial
            color="#06b6d4"
            :wireframe="true"
          />
        </TresMesh>

        <!-- Wheels: wireframe cylinders. Triangulation reads like spokes. -->
        <TresGroup
          :position="[-TRACK, flY, WHEELBASE]"
          :rotation-y="steerAngle"
        >
          <TresMesh :rotation="WHEEL_LAY_DOWN">
            <TresCylinderGeometry :args="[WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 16]" />
            <TresMeshBasicMaterial
              color="#a1a1aa"
              :wireframe="true"
            />
          </TresMesh>
        </TresGroup>
        <TresGroup
          :position="[TRACK, frY, WHEELBASE]"
          :rotation-y="steerAngle"
        >
          <TresMesh :rotation="WHEEL_LAY_DOWN">
            <TresCylinderGeometry :args="[WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 16]" />
            <TresMeshBasicMaterial
              color="#a1a1aa"
              :wireframe="true"
            />
          </TresMesh>
        </TresGroup>
        <TresMesh
          :position="[-TRACK, rlY, -WHEELBASE]"
          :rotation="WHEEL_LAY_DOWN"
        >
          <TresCylinderGeometry :args="[WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 16]" />
          <TresMeshBasicMaterial
            color="#a1a1aa"
            :wireframe="true"
          />
        </TresMesh>
        <TresMesh
          :position="[TRACK, rrY, -WHEELBASE]"
          :rotation="WHEEL_LAY_DOWN"
        >
          <TresCylinderGeometry :args="[WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 16]" />
          <TresMeshBasicMaterial
            color="#a1a1aa"
            :wireframe="true"
          />
        </TresMesh>

        <!-- Coil springs: torus rings stacked vertically. Ring spacing
             compresses with suspension travel. One block per corner. -->
        <TresMesh
          v-for="(y, i) in springFL"
          :key="`fl-${i}`"
          :position="[-TRACK, y, WHEELBASE]"
          :rotation="SPRING_ROTATION"
        >
          <TresTorusGeometry :args="[SPRING_RING_RADIUS, SPRING_TUBE_RADIUS, 8, 16]" />
          <TresMeshBasicMaterial color="#f59e0b" />
        </TresMesh>
        <TresMesh
          v-for="(y, i) in springFR"
          :key="`fr-${i}`"
          :position="[TRACK, y, WHEELBASE]"
          :rotation="SPRING_ROTATION"
        >
          <TresTorusGeometry :args="[SPRING_RING_RADIUS, SPRING_TUBE_RADIUS, 8, 16]" />
          <TresMeshBasicMaterial color="#f59e0b" />
        </TresMesh>
        <TresMesh
          v-for="(y, i) in springRL"
          :key="`rl-${i}`"
          :position="[-TRACK, y, -WHEELBASE]"
          :rotation="SPRING_ROTATION"
        >
          <TresTorusGeometry :args="[SPRING_RING_RADIUS, SPRING_TUBE_RADIUS, 8, 16]" />
          <TresMeshBasicMaterial color="#f59e0b" />
        </TresMesh>
        <TresMesh
          v-for="(y, i) in springRR"
          :key="`rr-${i}`"
          :position="[TRACK, y, -WHEELBASE]"
          :rotation="SPRING_ROTATION"
        >
          <TresTorusGeometry :args="[SPRING_RING_RADIUS, SPRING_TUBE_RADIUS, 8, 16]" />
          <TresMeshBasicMaterial color="#f59e0b" />
        </TresMesh>

        <!-- Acceleration force vectors at the chassis center.
             Longitudinal: green forward (throttle) / red back (brake).
             Lateral: amber. Arrows tilt with chassis (body-frame). -->
        <TresGroup :position="[0, CHASSIS_Y, 0]">
          <TresMesh
            :position="longBodyPos"
            :rotation="LONG_BODY_ROT"
          >
            <TresCylinderGeometry :args="[0.028, 0.028, longLen, 8]" />
            <TresMeshBasicMaterial :color="longColor" />
          </TresMesh>
          <TresMesh
            :position="longHeadPos"
            :rotation="longHeadRot"
          >
            <TresConeGeometry :args="[0.07, 0.14, 12]" />
            <TresMeshBasicMaterial :color="longColor" />
          </TresMesh>

          <TresMesh
            :position="latBodyPos"
            :rotation="LAT_BODY_ROT"
          >
            <TresCylinderGeometry :args="[0.028, 0.028, latLen, 8]" />
            <TresMeshBasicMaterial color="#fbbf24" />
          </TresMesh>
          <TresMesh
            :position="latHeadPos"
            :rotation="latHeadRot"
          >
            <TresConeGeometry :args="[0.07, 0.14, 12]" />
            <TresMeshBasicMaterial color="#fbbf24" />
          </TresMesh>
        </TresGroup>
      </TresGroup>
    </TresCanvas>
  </ClientOnly>
</template>
