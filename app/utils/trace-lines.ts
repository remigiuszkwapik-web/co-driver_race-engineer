/**
 * Line definitions for the two TraceStrip variants on /live.
 *
 * Lifted out of TraceStrip.vue so the component is config-driven and a single
 * implementation backs both the driver-input strip and the motor strip.
 */

import type { TraceSample } from './trace'

export interface LineDef {
  key: keyof TraceSample
  label: string
  color: string
  /** Map a sample value into 0..1 (1 = top of strip). */
  norm: (v: number) => number
  /** Render the right-edge current-value pill. */
  fmt: (v: number) => string
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
function clamp01(v: number): number {
  return clamp(v, 0, 1)
}

const YAW_RATE_RANGE = 3 // rad/s, clamps yaw line so it doesn't peg the edges

const INPUT_COLORS = {
  throttle: '#22c55e',
  brake: '#ef4444',
  steer: '#f59e0b',
  yawRate: '#3b82f6'
}

export const INPUT_TRACE_LINES: LineDef[] = [
  { key: 'throttle', label: 'THROTL', color: INPUT_COLORS.throttle, norm: v => 1 - clamp01(v), fmt: v => Math.round(v * 100) + '%' },
  { key: 'brake', label: 'BRAKE', color: INPUT_COLORS.brake, norm: v => 1 - clamp01(v), fmt: v => Math.round(v * 100) + '%' },
  { key: 'steer', label: 'STEER', color: INPUT_COLORS.steer, norm: v => 0.5 - clamp(v, -1, 1) / 2, fmt: v => (v >= 0 ? '+' : '') + Math.round(v * 100) + '%' },
  { key: 'yawRate', label: 'YAW/s', color: INPUT_COLORS.yawRate, norm: v => 0.5 - clamp(v, -YAW_RATE_RANGE, YAW_RATE_RANGE) / (YAW_RATE_RANGE * 2), fmt: v => v.toFixed(2) }
]

const MOTOR_COLORS = {
  rpm: '#ec4899',
  torque: '#06b6d4',
  power: '#a855f7'
}

/**
 * RPM normalizes against the per-sample rpmMax (redline) — the rare case where
 * a norm needs sample context, so it lives on the consumer side: live.vue
 * supplies the RPM line as a static def because rpmMax is always present in
 * the sample. Torque and power scale against an externally tracked running
 * max because the packet exposes no ceiling for either.
 */
export interface MotorScales {
  /** Max torque (Nm) observed in the visible window; protects against /0 with a 1 Nm floor. */
  maxTorqueNm: number
  /** Max power (kW) observed in the visible window; same floor logic. */
  maxPowerKw: number
}

export function motorTraceLines(scales: MotorScales): LineDef[] {
  const tqCeil = Math.max(1, scales.maxTorqueNm) * 1.05
  const pwCeil = Math.max(1, scales.maxPowerKw) * 1.05
  return [
    {
      key: 'rpm',
      label: 'RPM',
      color: MOTOR_COLORS.rpm,
      // Sample carries its own rpmMax but LineDef.norm only sees a single value,
      // so we approximate against a "tall" ceiling that's wide enough for any
      // car. Drivers care about the *shape* and the right-edge pill shows the
      // raw RPM, so the absolute scale here is intentionally generous.
      norm: v => 1 - clamp01(v / 10000),
      fmt: v => Math.round(v).toString()
    },
    {
      key: 'torqueNm',
      label: 'TQ',
      color: MOTOR_COLORS.torque,
      norm: v => 1 - clamp01(v / tqCeil),
      fmt: v => Math.round(v) + ' Nm'
    },
    {
      key: 'powerKw',
      label: 'PWR',
      color: MOTOR_COLORS.power,
      norm: v => 1 - clamp01(v / pwCeil),
      fmt: v => Math.round(v) + ' kW'
    }
  ]
}
