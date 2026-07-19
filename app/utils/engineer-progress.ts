/**
 * Session-over-session progress for the Race Engineer.
 *
 * The per-run engineer only sees the latest laps — it has no memory of your
 * journey. This compresses a session into a few comparable numbers and turns
 * "this session vs the one before" into plain-language progress ("wheelspin
 * eased 8:1 → 3.9:1", "best lap 0.5s faster"), so the tool tells you whether a
 * change actually helped.
 *
 * `summarizeSession` runs on the server (from FrameAggregates); `progressHints`
 * is a pure diff used by the client. Kept together so the shape stays in sync.
 */

import type { FrameAggregates } from './tune-signals'
import { TIRE_TEMP_COLD_C, TIRE_TEMP_HOT_C } from './tuning'

type Drivetrain = 'fwd' | 'rwd' | 'awd' | null

/** A whole session boiled down to the handful of numbers worth comparing. */
export interface SessionSummary {
  lapCount: number
  /** Best lap in ms (0 when unknown). */
  bestLapMs: number
  /** Mean |slip ratio| on the driven axle under throttle. */
  drivenSlip: number
  /** Inner:outer driven-wheel spin ratio in corners (1 = even, higher = more open-diff). */
  innerRatio: number
  /** Mean driven-axle tyre temperature (°C). */
  drivenTempC: number
  /** Front−rear slip-angle balance (+ understeer, − oversteer). */
  balance: number
}

function drivenPair(dt: Drivetrain): ['fl' | 'rl', 'fr' | 'rr'] {
  return dt === 'fwd' ? ['fl', 'fr'] : ['rl', 'rr']
}

/** Build a comparable SessionSummary from a session's aggregates. */
export function summarizeSession(
  signals: FrameAggregates,
  drivetrain: Drivetrain,
  bestLapMs: number,
  lapCount: number
): SessionSummary {
  const [l, r] = drivenPair(drivetrain)
  const drivenSlip = (signals.slipRatio[l] + signals.slipRatio[r]) / 2
  const drivenTempC = (signals.tireTempC[l] + signals.tireTempC[r]) / 2
  const bias = signals.diffBias
  const inner = drivetrain === 'fwd' ? bias.frontInner : bias.rearInner
  const outer = drivetrain === 'fwd' ? bias.frontOuter : bias.rearOuter
  const innerRatio = outer > 0 ? inner / outer : (inner > 0 ? inner : 0)
  return {
    lapCount,
    bestLapMs,
    drivenSlip,
    innerRatio,
    drivenTempC,
    balance: signals.slipAngle.frontAvg - signals.slipAngle.rearAvg
  }
}

export type HintDirection = 'better' | 'worse' | 'flat'

export interface ProgressHint {
  id: string
  direction: HintDirection
  text: string
}

export interface ProgressReport {
  hasComparison: boolean
  hints: ProgressHint[]
  /** Shown when there's a current session but nothing to compare it against. */
  note: string
}

function fmtLap(ms: number): string {
  const s = ms / 1000
  const m = Math.floor(s / 60)
  const rem = (s - m * 60).toFixed(2).padStart(5, '0')
  return m > 0 ? `${m}:${rem}` : `${rem}s`
}

function relChange(cur: number, prev: number): number {
  if (prev === 0) return 0
  return (cur - prev) / Math.abs(prev)
}

/** How far outside the 80–95 °C window a temperature sits (0 = inside). */
function tempMiss(t: number): number {
  if (t < TIRE_TEMP_COLD_C) return TIRE_TEMP_COLD_C - t
  if (t > TIRE_TEMP_HOT_C) return t - TIRE_TEMP_HOT_C
  return 0
}

/**
 * Diff two summaries into plain-language progress. Only reports changes big
 * enough to be real (measurement, not noise).
 */
export function progressHints(current: SessionSummary | null, previous: SessionSummary | null): ProgressReport {
  if (!current) return { hasComparison: false, hints: [], note: '' }
  if (!previous) {
    return {
      hasComparison: false,
      hints: [],
      note: 'First recorded session for this car — drive another and this will show what your changes did.'
    }
  }

  const hints: ProgressHint[] = []

  // Best lap
  if (current.bestLapMs > 0 && previous.bestLapMs > 0) {
    const delta = (current.bestLapMs - previous.bestLapMs) / 1000
    if (Math.abs(delta) >= 0.05) {
      hints.push({
        id: 'lap',
        direction: delta < 0 ? 'better' : 'worse',
        text: delta < 0
          ? `Best lap ${Math.abs(delta).toFixed(2)}s faster (${fmtLap(current.bestLapMs)} vs ${fmtLap(previous.bestLapMs)}).`
          : `Best lap ${delta.toFixed(2)}s slower (${fmtLap(current.bestLapMs)} vs ${fmtLap(previous.bestLapMs)}).`
      })
    }
  }

  // Wheelspin (lower is better)
  if (Math.abs(relChange(current.drivenSlip, previous.drivenSlip)) >= 0.08) {
    const better = current.drivenSlip < previous.drivenSlip
    hints.push({
      id: 'wheelspin',
      direction: better ? 'better' : 'worse',
      text: `Wheelspin ${better ? 'down' : 'up'}: ${previous.drivenSlip.toFixed(2)} → ${current.drivenSlip.toFixed(2)} slip under throttle.`
    })
  }

  // Inner:outer ratio (lower is better — diff getting less open)
  if (previous.innerRatio >= 1.5 && Math.abs(relChange(current.innerRatio, previous.innerRatio)) >= 0.12) {
    const better = current.innerRatio < previous.innerRatio
    hints.push({
      id: 'diff-bias',
      direction: better ? 'better' : 'worse',
      text: `Inner-wheel spin ${better ? 'easing' : 'growing'}: ${previous.innerRatio.toFixed(1)}:1 → ${current.innerRatio.toFixed(1)}:1.`
    })
  }

  // Driven tyre temp — better when it moves toward the window
  if (Math.abs(current.drivenTempC - previous.drivenTempC) >= 3) {
    const missBefore = tempMiss(previous.drivenTempC)
    const missNow = tempMiss(current.drivenTempC)
    const warmer = current.drivenTempC > previous.drivenTempC
    const inWindow = missNow === 0
    hints.push({
      id: 'tyre-temp',
      direction: missNow < missBefore ? 'better' : (missNow > missBefore ? 'worse' : 'flat'),
      text: `Driven tyres ${warmer ? 'warmer' : 'cooler'}: ${previous.drivenTempC.toFixed(0)} → ${current.drivenTempC.toFixed(0)} °C${inWindow ? ' (in the grip window)' : missNow < missBefore ? ' (closer to the window)' : ''}.`
    })
  }

  // Balance — better when it moves toward neutral
  if (Math.abs(Math.abs(current.balance) - Math.abs(previous.balance)) >= 0.02) {
    const better = Math.abs(current.balance) < Math.abs(previous.balance)
    hints.push({
      id: 'balance',
      direction: better ? 'better' : 'worse',
      text: better
        ? 'Cornering balance more neutral than last time.'
        : 'Cornering balance drifted further from neutral.'
    })
  }

  return {
    hasComparison: true,
    hints,
    note: hints.length === 0 ? 'No meaningful change from your last session — the car is behaving about the same.' : ''
  }
}
