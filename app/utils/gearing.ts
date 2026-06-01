/**
 * Gearing derivation — turns a torque/power dyno curve plus measured gear
 * ratios into an Automation-style tractive-effort model (force / power / rpm
 * at the wheels vs vehicle speed, one series per gear).
 *
 * Forza's Data Out packet does NOT expose gear ratios. We derive them live:
 *
 *   combined ratio  R = ω_engine / ω_wheel   (engine:wheel reduction, folds in
 *                                              gearbox × final drive)
 *   rolling radius  r = v_ground / ω_wheel    (effective tire radius)
 *
 * where ω_engine = rpm·π/30 (rad/s) and ω_wheel is the driven-wheel angular
 * velocity from the FH6 `wheelRotation` quad (rad/s). R is purely mechanical —
 * it holds even under wheelspin because engine and driven wheels are rigidly
 * coupled — so a handful of clean frames pins it exactly. The radius is read
 * from the *non-driven* wheels (which don't slip under power) so wheelspin
 * doesn't inflate it.
 *
 * From those two measured quantities and the dyno torque curve, at a given
 * vehicle speed in gear i:
 *
 *   rpm     = (v / r) · R · 30/π
 *   force   = torque(rpm) · R / r     (tractive effort at the contact patch)
 *   power   = engine power(rpm)       (radius/ratio cancel — wheel power equals
 *                                      engine power in every gear; the dips in
 *                                      the envelope ARE the upshift loss)
 *
 * Radius scales force by 1/r and speed by r uniformly across gears, so the
 * *shape* of the sawtooth — gear spacing, where you fall off the power — is
 * independent of any radius error.
 *
 * Pure module — no Vue, no Nuxt — so it's trivially unit-testable, mirroring
 * dyno.ts which it consumes.
 */

import type { Quad, Telemetry } from '../../server/utils/decode'
import type { DynoBucket, DynoCurve } from './dyno'

/** Forward gears in Forza's raw encoding: 0=R, 1..10=forward, 11=N (mid-shift). */
const FORWARD_MIN = 1
const FORWARD_MAX = 10
/** rpm → rad/s. */
const RPM_TO_RADS = Math.PI / 30
/** Minimum clean frames before a gear's ratio is trusted. R is deterministic,
 *  so this only needs to clear transient mid-shift noise. */
const MIN_RATIO_SAMPLES = 4
/** Clutch must be essentially released (engaged) — a slipping clutch breaks the
 *  rigid engine↔wheel coupling that makes R a constant. */
const CLUTCH_ENGAGED_MAX = 0.1
/** Driven-wheel angular speed floor (rad/s) — below this rpm/ω is numerically noisy. */
const MIN_WHEEL_RADS = 3
/** Slip ceiling for radius samples (non-driven wheels barely slip; keep it tight). */
const RADIUS_SLIP_MAX = 0.05
/** Ground-speed floor (km/h) for radius samples. */
const RADIUS_MIN_KMH = 15
/** Plausibility bounds — drop garbage from partial shifts / decode hiccups. */
const RATIO_MIN = 1
const RATIO_MAX = 60
const RADIUS_MIN_M = 0.2
const RADIUS_MAX_M = 0.6
/** Fallback rolling radius (m) used only until a real one is measured — sets
 *  the absolute axes; the sawtooth shape is radius-invariant. */
const FALLBACK_RADIUS_M = 0.32

export interface GearEstimate {
  /** Forward gear number (1..10). */
  gear: number
  /** Combined engine:wheel reduction (gearbox × final drive). */
  ratio: number
  /** Clean frames that fed this estimate. */
  samples: number
}

export interface GearingModel {
  /** Forward gears with a trusted ratio, ascending. */
  gears: GearEstimate[]
  /** Effective rolling radius (m), or null until enough clean frames seen. */
  tireRadiusM: number | null
  /** Driven-wheel layout the ratios were measured on (0=FWD, 1=RWD, 2=AWD). */
  drivetrain: number | null
}

/** Streaming accumulator. Mutated in place by `ingestGearingFrame`. */
export interface GearingState {
  byGear: Map<number, { ratioSum: number, count: number }>
  radiusSum: number
  radiusCount: number
  drivetrain: number | null
}

export function emptyGearingState(): GearingState {
  return { byGear: new Map(), radiusSum: 0, radiusCount: 0, drivetrain: null }
}

/** Mean |rotation| of the requested wheels (rad/s). */
function avgRot(rot: Quad, wheels: (keyof Quad)[]): number {
  let sum = 0
  for (const w of wheels) sum += Math.abs(rot[w])
  return sum / wheels.length
}

function avgSlip(slip: Quad, wheels: (keyof Quad)[]): number {
  let sum = 0
  for (const w of wheels) sum += Math.abs(slip[w])
  return sum / wheels.length
}

/** Wheels coupled to the engine, by drivetrain (0=FWD, 1=RWD, 2=AWD). */
function drivenWheels(drivetrain: number): (keyof Quad)[] {
  if (drivetrain === 0) return ['fl', 'fr']
  if (drivetrain === 1) return ['rl', 'rr']
  return ['fl', 'fr', 'rl', 'rr']
}

/** Wheels used for the rolling-radius read — the non-driven axle when there is
 *  one (it doesn't slip under power), else all four for AWD. */
function radiusWheels(drivetrain: number): (keyof Quad)[] {
  if (drivetrain === 0) return ['rl', 'rr']
  if (drivetrain === 1) return ['fl', 'fr']
  return ['fl', 'fr', 'rl', 'rr']
}

/**
 * Ingest one frame into the streaming state. Mutates `state` in place. Needs
 * the FH6 `wheelRotation` channel — frames without it (other feeds) are no-ops.
 */
export function ingestGearingFrame(state: GearingState, f: Telemetry): void {
  const rot = f.wheelRotation
  if (!rot) return
  if (f.gear < FORWARD_MIN || f.gear > FORWARD_MAX) return
  if (f.clutch > CLUTCH_ENGAGED_MAX) return
  if (f.rpm <= 0) return

  const dt = f.car.drivetrain
  state.drivetrain = dt

  // --- ratio: ω_engine / ω_driven-wheel (mechanical, slip-independent) ---
  const wDriven = avgRot(rot, drivenWheels(dt))
  if (wDriven >= MIN_WHEEL_RADS) {
    const ratio = (f.rpm * RPM_TO_RADS) / wDriven
    if (ratio >= RATIO_MIN && ratio <= RATIO_MAX) {
      const b = state.byGear.get(f.gear) ?? { ratioSum: 0, count: 0 }
      b.ratioSum += ratio
      b.count++
      state.byGear.set(f.gear, b)
    }
  }

  // --- rolling radius: v_ground / ω_non-driven-wheel (low-slip only) ---
  if (f.speedKmh >= RADIUS_MIN_KMH) {
    const refWheels = radiusWheels(dt)
    if (avgSlip(f.slipRatio, refWheels) < RADIUS_SLIP_MAX) {
      const wRef = avgRot(rot, refWheels)
      if (wRef >= MIN_WHEEL_RADS) {
        const r = (f.speedKmh / 3.6) / wRef
        if (r >= RADIUS_MIN_M && r <= RADIUS_MAX_M) {
          state.radiusSum += r
          state.radiusCount++
        }
      }
    }
  }
}

export function snapshotGearing(state: GearingState): GearingModel {
  const gears: GearEstimate[] = []
  for (const [gear, b] of state.byGear) {
    if (b.count < MIN_RATIO_SAMPLES) continue
    gears.push({ gear, ratio: b.ratioSum / b.count, samples: b.count })
  }
  gears.sort((a, b) => a.gear - b.gear)
  return {
    gears,
    tireRadiusM: state.radiusCount > 0 ? state.radiusSum / state.radiusCount : null,
    drivetrain: state.drivetrain
  }
}

// --- chart model (shared-speed grid for the linked uPlot multiple) ---------
//
// All panels share one x-axis (vehicle speed) so uPlot's cursor.sync lines them
// up by x-value: hovering a speed marks the same speed on force, power and rpm.
// Each gear is one series, sampled onto the shared speed grid with `null`
// outside its rpm range (uPlot draws those as gaps).

export interface GearGridSeries {
  gear: number
  ratio: number
  /** Tractive force (N) at each grid speed; null outside this gear's rpm range. */
  force: (number | null)[]
  /** Wheel power (kW) — equals engine power. Null outside range. */
  power: (number | null)[]
  /** Engine rpm at each grid speed; null outside range. */
  rpm: (number | null)[]
}

export interface GearingGrid {
  /** Shared x-axis: vehicle speed (km/h), ascending. */
  speedsKmh: number[]
  series: GearGridSeries[]
  maxForceN: number
  maxPowerKw: number
  maxRpm: number
  /** False when torque is unavailable — only power/rpm can be drawn. */
  hasForce: boolean
}

export interface GearingGridOptions {
  /** Grid resolution in km/h. Default 2. */
  stepKmh?: number
}

function speedKmhToRpm(speedKmh: number, ratio: number, radiusM: number): number {
  const wEngine = ((speedKmh / 3.6) * ratio) / radiusM
  return wEngine / RPM_TO_RADS
}

function rpmToSpeedKmh(rpm: number, ratio: number, radiusM: number): number {
  const speedMps = ((rpm * RPM_TO_RADS) / ratio) * radiusM
  return speedMps * 3.6
}

/** Linear-interpolate a dyno channel at an arbitrary rpm. Returns null outside
 *  the measured bucket range — no extrapolation. */
function interpDyno(dyno: DynoCurve, rpm: number, pick: (b: DynoBucket) => number): number | null {
  const b = dyno.buckets
  if (b.length === 0) return null
  if (rpm < b[0]!.rpm || rpm > b[b.length - 1]!.rpm) return null
  for (let i = 1; i < b.length; i++) {
    const lo = b[i - 1]!
    const hi = b[i]!
    if (rpm <= hi.rpm) {
      const span = hi.rpm - lo.rpm
      const t = span > 0 ? (rpm - lo.rpm) / span : 0
      return pick(lo) + t * (pick(hi) - pick(lo))
    }
  }
  return pick(b[b.length - 1]!)
}

/**
 * Resample the dyno curve onto a shared speed grid for every measured gear.
 * `model.tireRadiusM` sets the absolute axes; null falls back to a nominal
 * radius (only the labels shift — the sawtooth shape is radius-invariant).
 */
export function buildGearingGrid(dyno: DynoCurve, model: GearingModel, opts?: GearingGridOptions): GearingGrid {
  const step = opts?.stepKmh ?? 2
  const radius = model.tireRadiusM ?? FALLBACK_RADIUS_M
  const hasForce = dyno.peakTorque !== null

  if (dyno.buckets.length === 0 || model.gears.length === 0) {
    return { speedsKmh: [], series: [], maxForceN: 0, maxPowerKw: 0, maxRpm: 0, hasForce }
  }

  const minRpm = dyno.buckets[0]!.rpm
  const maxRpm = dyno.buckets[dyno.buckets.length - 1]!.rpm

  // Top of the speed axis = fastest gear at its top measured rpm.
  let maxSpeedKmh = 0
  for (const g of model.gears) {
    const s = rpmToSpeedKmh(maxRpm, g.ratio, radius)
    if (s > maxSpeedKmh) maxSpeedKmh = s
  }
  const topSpeed = Math.ceil(maxSpeedKmh / step) * step

  const speedsKmh: number[] = []
  for (let s = 0; s <= topSpeed + 1e-9; s += step) speedsKmh.push(Number(s.toFixed(3)))

  let maxForceN = 0
  let maxPowerKw = 0
  let maxRpmSeen = 0

  const series: GearGridSeries[] = model.gears.map((g) => {
    const force: (number | null)[] = []
    const power: (number | null)[] = []
    const rpm: (number | null)[] = []
    for (const s of speedsKmh) {
      const r = speedKmhToRpm(s, g.ratio, radius)
      if (r < minRpm || r > maxRpm) {
        force.push(null)
        power.push(null)
        rpm.push(null)
        continue
      }
      const tq = interpDyno(dyno, r, b => b.maxTorqueNm)
      const pw = interpDyno(dyno, r, b => b.maxPowerKw)
      const f = tq === null ? null : (tq * g.ratio) / radius
      force.push(f)
      power.push(pw)
      rpm.push(r)
      if (f !== null && f > maxForceN) maxForceN = f
      if (pw !== null && pw > maxPowerKw) maxPowerKw = pw
      if (r > maxRpmSeen) maxRpmSeen = r
    }
    return { gear: g.gear, ratio: g.ratio, force, power, rpm }
  })

  return { speedsKmh, series, maxForceN, maxPowerKw, maxRpm: maxRpmSeen, hasForce }
}
