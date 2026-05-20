/**
 * Dyno binning — derives an engine torque/power curve from decoded Telemetry
 * frames.
 *
 * Two consumers feed this:
 *  - Recorded surfaces (session-detail card, replay player) bin a finite buffer
 *    via `binFrames()` and render the result.
 *  - The live `/dyno` page holds a `DynoState` across the page's lifetime,
 *    calls `ingestFrame()` on every new telemetry frame, and `snapshot()`s
 *    for rendering. Resetting on car change is the caller's responsibility.
 *
 * Pure module — no Vue, no Nuxt — so it's trivially unit-testable.
 */

import type { Telemetry } from '../../server/utils/decode'

export interface DynoBucket {
  /** Centre of the bin in RPM. */
  rpm: number
  /** Max torque (Nm) observed in this bin. */
  maxTorqueNm: number
  /** Max power (kW) observed in this bin. */
  maxPowerKw: number
  /** Frames that landed in this bin (after the WOT gate). */
  samples: number
}

export interface DynoPeak {
  rpm: number
  value: number
}

export interface DynoCurve {
  /** Buckets sorted by ascending RPM. */
  buckets: DynoBucket[]
  peakTorque: DynoPeak | null
  peakPower: DynoPeak | null
  /** Idle RPM (carried in every frame). Falls back to 700 if no frame ingested. */
  rpmIdle: number
  /** Max RPM observed; 0 if no frame ingested. */
  rpmMax: number
}

export interface DynoBinOptions {
  /** RPM bin width. Default 200. */
  binWidth?: number
  /** Throttle threshold (0..1) for a frame to count. Default 0.9 — coast and
   *  braking frames otherwise pull max(torque, power) downward. */
  wotThreshold?: number
}

const DEFAULT_BIN_WIDTH = 200
const DEFAULT_WOT = 0.9
const FALLBACK_IDLE = 700

/** Streaming state for the live accumulator. Mutated in place by `ingestFrame`. */
export interface DynoState {
  buckets: Map<number, DynoBucket>
  /** Last non-zero rpmIdle observed. Per-car constant, so this is stable across a session. */
  lastIdle: number | null
  /** Running max of `frame.rpm` across all ingested frames (not gated by WOT — used purely for axis sizing). */
  rpmMax: number
}

export function emptyDynoState(): DynoState {
  return { buckets: new Map(), lastIdle: null, rpmMax: 0 }
}

/**
 * Ingest one frame into the streaming state. Mutates `state` in place.
 *
 * Axis-sizing facts (`rpmIdle`, `rpmMax`) are tracked from *every* frame —
 * those are properties of the car, not the pull. The bucket aggregation is
 * gated by the WOT threshold so it represents true engine output.
 */
export function ingestFrame(state: DynoState, f: Telemetry, opts?: DynoBinOptions): void {
  const binWidth = opts?.binWidth ?? DEFAULT_BIN_WIDTH
  const wot = opts?.wotThreshold ?? DEFAULT_WOT

  if (f.rpmIdle > 0) state.lastIdle = f.rpmIdle
  if (f.rpm > state.rpmMax) state.rpmMax = f.rpm

  if (f.throttle < wot) return
  if (f.rpm <= 0) return

  const rpmBin = Math.round(f.rpm / binWidth) * binWidth
  const tq = f.torque
  const pw = f.power / 1000

  const existing = state.buckets.get(rpmBin)
  if (existing) {
    if (tq > existing.maxTorqueNm) existing.maxTorqueNm = tq
    if (pw > existing.maxPowerKw) existing.maxPowerKw = pw
    existing.samples += 1
  } else {
    state.buckets.set(rpmBin, {
      rpm: rpmBin,
      maxTorqueNm: tq,
      maxPowerKw: pw,
      samples: 1
    })
  }
}

export function snapshot(state: DynoState): DynoCurve {
  const buckets = Array.from(state.buckets.values()).sort((a, b) => a.rpm - b.rpm)
  let peakTorque: DynoPeak | null = null
  let peakPower: DynoPeak | null = null
  for (const b of buckets) {
    if (peakTorque === null || b.maxTorqueNm > peakTorque.value) {
      peakTorque = { rpm: b.rpm, value: b.maxTorqueNm }
    }
    if (peakPower === null || b.maxPowerKw > peakPower.value) {
      peakPower = { rpm: b.rpm, value: b.maxPowerKw }
    }
  }
  return {
    buckets,
    peakTorque,
    peakPower,
    rpmIdle: state.lastIdle ?? FALLBACK_IDLE,
    rpmMax: state.rpmMax
  }
}

/**
 * One-shot helper: bin a finite frame buffer and return a complete curve. Used
 * by the server-side session aggregation and by the replay-as-it-plays computed.
 */
export function binFrames(frames: Telemetry[], opts?: DynoBinOptions): DynoCurve {
  const state = emptyDynoState()
  for (const f of frames) ingestFrame(state, f, opts)
  return snapshot(state)
}

/**
 * Powerband boundaries: the RPM range where torque is at least `threshold` of
 * peak torque. Returns null if there's no peak to compare against. Used by the
 * detailed-mode shading on the gear-tuning page.
 */
export function powerbandRange(curve: DynoCurve, threshold = 0.9): { low: number, high: number } | null {
  if (!curve.peakTorque || curve.buckets.length === 0) return null
  const limit = curve.peakTorque.value * threshold
  let low = curve.peakTorque.rpm
  let high = curve.peakTorque.rpm
  let any = false
  for (const b of curve.buckets) {
    if (b.maxTorqueNm >= limit) {
      if (!any || b.rpm < low) low = b.rpm
      if (!any || b.rpm > high) high = b.rpm
      any = true
    }
  }
  return any ? { low, high } : null
}
