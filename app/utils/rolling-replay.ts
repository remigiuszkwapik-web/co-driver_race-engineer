/**
 * Client-side rolling-measurement series for the replay view.
 *
 * /live gets TB% / coast / pedal-overlap as a *streamed* feed: the server's
 * RollingMeasurement aggregators (server/utils/rolling-*.ts) emit one reading
 * per ~12 frames over the live telemetry bus. Replay has no such stream — it's
 * a finished lap blob — so we batch-compute the identical series here over the
 * whole lap, once, and let MeasurementStrip clip to the playhead window.
 *
 * The window span (30 s) and emit cadence (every 12 frames ≈ 5 Hz) mirror
 * ROLLING_WINDOW_MS / EMIT_EVERY_N_FRAMES in rolling-window.ts so a strip reads
 * identically whether it's fed live or from replay. The coast / overlap
 * predicate thresholds mirror rolling-coast-time.ts and rolling-pedal-overlap.ts
 * verbatim; keep them in sync if the server definitions change.
 *
 * Pure module — no Vue — so the component just wraps these in computeds.
 */

import type { Telemetry } from '../../server/utils/decode'
import type { MeasurementBand } from '../../server/utils/forza-bus'
import type { MeasurementSample } from '~/composables/useTelemetry'
import { detectTrailBraking, trailBrakingBands, TRAIL_BRAKE_MIN } from './trail-braking'

const WINDOW_MS = 30_000
const EMIT_EVERY_N_FRAMES = 12

// coast: off both pedals while still turning (rolling-coast-time.ts).
const COAST_THROTTLE_MAX = 0.05
const COAST_BRAKE_MAX = 0.05
const COAST_STEER_MIN = 0.1
// overlap: both pedals meaningfully applied at once (rolling-pedal-overlap.ts).
const OVERLAP_THROTTLE_MIN = 0.05
const OVERLAP_BRAKE_MIN = 0.05

/**
 * Time-ratio series: numerator = frames where `qualifies` holds, denominator =
 * the full window (matches coast / overlap, which are defined for any non-empty
 * window and emit 0 — not NaN — when nothing qualifies). Incremental counts keep
 * this O(n) over the lap.
 */
function rollingRatioSeries(
  frames: Telemetry[],
  qualifies: (f: Telemetry) => boolean
): MeasurementSample[] {
  const out: MeasurementSample[] = []
  if (frames.length === 0) return out
  let windowStart = 0
  let count = 0
  for (let i = 0; i < frames.length; i++) {
    if (qualifies(frames[i]!)) count++
    const cutoff = frames[i]!.timestampMs - WINDOW_MS
    while (windowStart < i && frames[windowStart]!.timestampMs < cutoff) {
      if (qualifies(frames[windowStart]!)) count--
      windowStart++
    }
    if ((i + 1) % EMIT_EVERY_N_FRAMES !== 0) continue
    const n = i - windowStart + 1
    out.push({
      value: n > 0 ? count / n : 0,
      startMs: frames[windowStart]!.timestampMs,
      endMs: frames[i]!.timestampMs
    })
  }
  return out
}

export function rollingCoastSeries(frames: Telemetry[]): MeasurementSample[] {
  return rollingRatioSeries(
    frames,
    f => f.throttle < COAST_THROTTLE_MAX && f.brake < COAST_BRAKE_MAX && Math.abs(f.steer) > COAST_STEER_MIN
  )
}

export function rollingOverlapSeries(frames: Telemetry[]): MeasurementSample[] {
  return rollingRatioSeries(
    frames,
    f => f.throttle > OVERLAP_THROTTLE_MIN && f.brake > OVERLAP_BRAKE_MIN
  )
}

/**
 * TB% rolling series + the discrete episode bands behind it — one detector pass
 * feeds both, so they agree by construction (same pairing as RollingTbPercent).
 * Denominator is *braking* frames, not the whole window, so the ratio is
 * "fraction of braking spent trail-braking"; NaN when the window has no braking
 * (rendered as "—"), matching the server.
 */
export function rollingTb(frames: Telemetry[]): { series: MeasurementSample[], bands: MeasurementBand[] } {
  if (frames.length === 0) return { series: [], bands: [] }
  const flags = detectTrailBraking(frames)
  const series: MeasurementSample[] = []
  let windowStart = 0
  let braking = 0
  let trail = 0
  for (let i = 0; i < frames.length; i++) {
    if (frames[i]!.brake >= TRAIL_BRAKE_MIN) braking++
    if (flags[i]) trail++
    const cutoff = frames[i]!.timestampMs - WINDOW_MS
    while (windowStart < i && frames[windowStart]!.timestampMs < cutoff) {
      if (frames[windowStart]!.brake >= TRAIL_BRAKE_MIN) braking--
      if (flags[windowStart]) trail--
      windowStart++
    }
    if ((i + 1) % EMIT_EVERY_N_FRAMES !== 0) continue
    series.push({
      value: braking > 0 ? trail / braking : Number.NaN,
      startMs: frames[windowStart]!.timestampMs,
      endMs: frames[i]!.timestampMs
    })
  }
  const bands = trailBrakingBands(flags).map(b => ({
    startMs: frames[b.startIdx]!.timestampMs,
    endMs: frames[b.endIdx]!.timestampMs
  }))
  return { series, bands }
}

/**
 * Keep only the readings up to the playhead so MeasurementStrip's right-edge
 * pill reads the *current* rolling value, not the lap's final one. Series is
 * sorted by endMs ascending → binary-search the cutoff.
 */
export function seriesUpTo(series: MeasurementSample[], t: number): MeasurementSample[] {
  let lo = 0
  let hi = series.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (series[mid]!.endMs <= t) lo = mid + 1
    else hi = mid
  }
  return series.slice(0, lo)
}
