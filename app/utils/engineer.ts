/**
 * Race Engineer — the prescriptive layer co-driver deliberately leaves out.
 *
 * co-driver's philosophy is "measurement, not prescription": every /tune page
 * shows you a signal and lets you decide. This module adds the opposite — it
 * reads the already-computed FrameAggregates for the current car/build and
 * returns a *ranked* diagnosis with a single recommended change and the reason,
 * the way a race engineer would debrief you after a run.
 *
 * It reuses the shared measurement pipeline (FrameAggregates from tune-signals)
 * and links each finding back to the matching /tune/<slug> reference page, so it
 * complements the existing tool instead of duplicating it.
 *
 * Thresholds are provisional and intentionally conservative; tune them as real
 * FH6 data accumulates.
 */

import { TIRE_TEMP_COLD_C, TIRE_TEMP_HOT_C, SLIP_THRESHOLD } from './tuning'

/** Local alias (kept un-exported so it doesn't collide with the auto-imported
 *  Drivetrain from tune-data-bindings). */
type Drivetrain = 'fwd' | 'rwd' | 'awd' | null

/**
 * The subset of FrameAggregates the engineer reads. Declared structurally so a
 * full FrameAggregates value satisfies it and unit tests can pass minimal
 * fixtures without building the whole aggregate.
 */
export interface EngineerSignals {
  suspensionTravel: { bottomingPct: number }
  slipAngle: { frontAvg: number, rearAvg: number }
  slipRatio: { fl: number, fr: number, rl: number, rr: number, throttleFrames: number }
  tireTempC: { fl: number, fr: number, rl: number, rr: number }
  gear: { atRevLimitPct: number }
}

/** Minimal structural input — a TuneDataResponse satisfies this. */
export interface EngineerInput {
  drivetrain: Drivetrain
  lapCount: number
  signals: EngineerSignals
}

export type Severity = 'high' | 'medium' | 'low'

export interface EngineerFinding {
  /** Stable id for keys/testing. */
  id: string
  severity: Severity
  /** Short headline, e.g. "Understeer (moderate)". */
  title: string
  /** Measured evidence in plain language, with the numbers. */
  evidence: string
  /** One-sentence mechanism — the "why". */
  why: string
  /** The single change to try. */
  lever: string
  /** Matching /tune/<slug> reference page. */
  slug: string
}

export interface EngineerReport {
  hasData: boolean
  /** Highest-priority finding, or null when the car looks balanced. */
  headline: EngineerFinding | null
  /** All findings, most important first (includes the headline). */
  findings: EngineerFinding[]
  /** One-line verdict shown when there is nothing urgent to fix. */
  allClear: string
}

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 }

function pct(x: number): string {
  return `${Math.round(x * 100)}%`
}

/** Rear (driven) wheels for RWD, front for FWD, all for AWD. */
function drivenSlip(s: EngineerSignals['slipRatio'], dt: Drivetrain): number {
  if (dt === 'fwd') return (s.fl + s.fr) / 2
  if (dt === 'awd') return (s.fl + s.fr + s.rl + s.rr) / 4
  // rwd or unknown → assume rear-driven (most common tuned FH car)
  return (s.rl + s.rr) / 2
}

export function analyzeCar(input: EngineerInput | null | undefined): EngineerReport {
  if (!input || input.lapCount === 0) {
    return { hasData: false, headline: null, findings: [], allClear: '' }
  }

  const { signals: sig, drivetrain } = input
  const findings: EngineerFinding[] = []

  // 1) Bottoming — corrupts every other reading, so it is checked first.
  const bottom = sig.suspensionTravel.bottomingPct
  if (bottom > 0.02) {
    findings.push({
      id: 'bottoming',
      severity: bottom > 0.05 ? 'high' : 'medium',
      title: `Car bottoms out (${pct(bottom)} of the lap)`,
      evidence: `Suspension travel hits the bump stop ${pct(bottom)} of the time.`,
      why: 'A car sitting on its stops loses grip and falsifies every balance reading — fix this before anything else.',
      lever: 'Raise ride height a little (or stiffen springs on the axle that bottoms)',
      slug: 'ride-height'
    })
  }

  // 2) Balance — front vs rear slip angle. Ratio is scale-independent, so the
  //    straight-line dilution in the averages cancels out.
  const fa = sig.slipAngle.frontAvg
  const ra = sig.slipAngle.rearAvg
  if (fa > 1e-4 && ra > 1e-4) {
    const ratio = fa / ra
    if (ratio >= 1.12) {
      const strong = ratio >= 1.3
      findings.push({
        id: 'understeer',
        severity: strong ? 'high' : 'medium',
        title: `Understeer (${strong ? 'strong' : 'moderate'})`,
        evidence: `Front slip angle runs ${Math.round((ratio - 1) * 100)}% higher than the rear — the front is doing more work than it can hold.`,
        why: 'The front axle is over-worked relative to the rear, so the car pushes wide.',
        lever: 'Soften the front anti-roll bar one step (adds front grip without touching top speed)',
        slug: 'anti-roll-bars'
      })
    } else if (ratio <= 0.89) {
      const strong = ratio <= 0.77
      findings.push({
        id: 'oversteer',
        severity: strong ? 'high' : 'medium',
        title: `Oversteer (${strong ? 'strong' : 'moderate'})`,
        evidence: `Rear slip angle runs ${Math.round((1 / ratio - 1) * 100)}% higher than the front — the rear is letting go first.`,
        why: 'The rear axle runs out of grip before the front, so the tail steps out.',
        lever: 'Soften the rear anti-roll bar one step (adds rear grip)',
        slug: 'anti-roll-bars'
      })
    }
  }

  // 3) Traction under power on the driven axle.
  const slip = drivenSlip(sig.slipRatio, drivetrain)
  if (sig.slipRatio.throttleFrames > 0 && slip > SLIP_THRESHOLD * 1.5) {
    const axle = drivetrain === 'fwd' ? 'front' : 'rear'
    findings.push({
      id: 'traction',
      severity: slip > SLIP_THRESHOLD * 3 ? 'high' : 'medium',
      title: 'Wheelspin on power',
      evidence: `Driven (${axle}) wheels average ${slip.toFixed(2)} slip ratio under throttle — that spinning is lost drive out of corners.`,
      why: 'Torque is overwhelming the driven tyres, so grip that could push you forward is wasted as spin.',
      lever: 'Tune the differential acceleration lock (and check driven-tyre grip/pressure); ease throttle until tyres are warm',
      slug: 'differential'
    })
  }

  // 4) Tyre temperature window (co-driver's optimal band is 85..100 °C).
  const t = sig.tireTempC
  const frontTemp = (t.fl + t.fr) / 2
  const rearTemp = (t.rl + t.rr) / 2
  const coldest = Math.min(frontTemp, rearTemp)
  const hottest = Math.max(frontTemp, rearTemp)
  if (hottest > TIRE_TEMP_HOT_C) {
    const axle = frontTemp >= rearTemp ? 'front' : 'rear'
    findings.push({
      id: 'tyre-hot',
      severity: 'medium',
      title: `${axle === 'front' ? 'Front' : 'Rear'} tyres overheating`,
      evidence: `${axle === 'front' ? 'Front' : 'Rear'} tyres average ${Math.round(hottest)} °C, above the ~95 °C window.`,
      why: 'Overheated tyres lose grip over a stint and wear fast.',
      lever: `Raise ${axle} tyre pressure a little (or ease the load on that axle)`,
      slug: 'tire-pressure'
    })
  } else if (coldest < TIRE_TEMP_COLD_C) {
    const axle = frontTemp <= rearTemp ? 'front' : 'rear'
    findings.push({
      id: 'tyre-cold',
      severity: 'low',
      title: `${axle === 'front' ? 'Front' : 'Rear'} tyres running cold`,
      evidence: `${axle === 'front' ? 'Front' : 'Rear'} tyres average ${Math.round(coldest)} °C, below the ~80 °C grip window.`,
      why: 'Cold tyres give less grip and spin up more easily — part of this is a warm-up/first-lap effect.',
      lever: `Lower ${axle} tyre pressure a little to build heat faster`,
      slug: 'tire-pressure'
    })
  }

  // 5) Gearing — time spent bouncing off the limiter.
  if (sig.gear.atRevLimitPct > 0.08) {
    findings.push({
      id: 'rev-limit',
      severity: 'low',
      title: 'Hitting the rev limiter',
      evidence: `You sit on the limiter ${pct(sig.gear.atRevLimitPct)} of the lap — that time is capped acceleration.`,
      why: 'A gear (or the final drive) is too short, so you run out of revs before the next shift.',
      lever: 'Lengthen the final drive a touch, or space the gears that hit the limiter',
      slug: 'gearing'
    })
  }

  findings.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])

  return {
    hasData: true,
    headline: findings[0] ?? null,
    findings,
    allClear: findings.length === 0
      ? 'Nothing urgent in the data — balance, traction, tyres and ride height all look reasonable. Drive it, then come back with what still bothers you.'
      : ''
  }
}
