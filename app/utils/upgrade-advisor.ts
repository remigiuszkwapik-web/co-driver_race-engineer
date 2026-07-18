/**
 * Upgrade Advisor — the build-side twin of the Race Engineer.
 *
 * The engineer answers "what should I *tune*". This answers "what should I
 * *build*": it reads the same telemetry, decides what is limiting the car
 * (grip vs nothing-in-particular), and recommends where to spend PI to max the
 * class — then links to co-driver's /upgrade/<slug> reference pages.
 *
 * Honest scope: telemetry shows the car's *behaviour* (direction), not the
 * available parts or their PI cost. The exact PI-to-cap budgeting lives on
 * /upgrade/homologate; this names the limiting factor and the direction.
 */

import { TIRE_TEMP_COLD_C, TIRE_TEMP_HOT_C, SLIP_THRESHOLD } from './tuning'

type Drivetrain = 'fwd' | 'rwd' | 'awd' | null

/** Structural subset of FrameAggregates the advisor reads. */
export interface UpgradeSignals {
  slipRatio: { fl: number, fr: number, rl: number, rr: number, throttleFrames: number }
  tireTempC: { fl: number, fr: number, rl: number, rr: number }
  gear: { atRevLimitPct: number }
}

export interface UpgradeInput {
  drivetrain: Drivetrain
  lapCount: number
  /** Class letter (D/C/B/A/S1/S2/R/X) for display, or null if unknown. */
  classLetter: string | null
  signals: UpgradeSignals
}

export type Limiter = 'grip' | 'balanced'

export interface UpgradeRec {
  title: string
  why: string
  /** Matching /upgrade/<slug> reference page. */
  slug: string
}

export interface UpgradeReport {
  hasData: boolean
  limiter: Limiter | null
  /** Plain-language read of what the data shows. */
  verdict: string
  /** Prioritised upgrade directions (most impactful first). */
  recommendations: UpgradeRec[]
  /** Context caveat shown under the recommendations. */
  note: string
}

function drivenSlip(s: UpgradeSignals['slipRatio'], dt: Drivetrain): number {
  if (dt === 'fwd') return (s.fl + s.fr) / 2
  if (dt === 'awd') return (s.fl + s.fr + s.rl + s.rr) / 4
  return (s.rl + s.rr) / 2
}

const WEIGHT_REC: UpgradeRec = {
  title: 'Weight reduction',
  why: 'The most PI-efficient gain there is — helps grip, braking and acceleration at once, and frees PI for the parts you actually want.',
  slug: 'weight'
}

export function adviseUpgrades(input: UpgradeInput | null | undefined): UpgradeReport {
  if (!input || input.lapCount === 0) {
    return { hasData: false, limiter: null, verdict: '', recommendations: [], note: '' }
  }

  const { signals: s, drivetrain } = input
  const slip = drivenSlip(s.slipRatio, drivetrain)
  const wheelspin = s.slipRatio.throttleFrames > 0 && slip > SLIP_THRESHOLD * 1.5

  const front = (s.tireTempC.fl + s.tireTempC.fr) / 2
  const rear = (s.tireTempC.rl + s.tireTempC.rr) / 2
  const tyresOffWindow = Math.min(front, rear) < TIRE_TEMP_COLD_C || Math.max(front, rear) > TIRE_TEMP_HOT_C

  const gripLimited = wheelspin || tyresOffWindow
  const cls = input.classLetter ? `${input.classLetter}-class` : 'the class'

  if (gripLimited) {
    return {
      hasData: true,
      limiter: 'grip',
      verdict: `The car is grip-limited — ${wheelspin ? `driven wheels average ${slip.toFixed(2)} slip under throttle` : 'tyres sit outside their grip window'}. Spend PI on grip, not power.`,
      recommendations: [
        {
          title: 'Tyres — grippier compound, and widen the fronts',
          why: 'Grip is your limit, so this is the highest-value PI you can spend. FH6 lets you widen front tyres as a cheap standalone cornering gain without a full compound jump.',
          slug: 'tires'
        },
        WEIGHT_REC
      ],
      note: `Build to the ${cls} PI cap putting PI into grip first, then tune. Not power — on a grip-limited car more torque just adds wheelspin. Exact PI budgeting: see /upgrade/homologate.`
    }
  }

  return {
    hasData: true,
    limiter: 'balanced',
    verdict: 'No single weakness stands out in the data — grip and traction look reasonable.',
    recommendations: [
      WEIGHT_REC,
      {
        title: 'Tyres — a compound/width step if PI allows',
        why: 'More grip is rarely wasted, and it is usually more lap time per PI than raw power on anything but the fastest tracks.',
        slug: 'tires'
      }
    ],
    note: `Weight reduction is the safe default when nothing is clearly limiting you. Build to the ${cls} cap, then tune. Power only pays on tracks with real straights — the data can't see the track layout, so use judgement there. PI budgeting: /upgrade/homologate.`
  }
}
