import { describe, it, expect } from 'vitest'
import { analyzeCar, type EngineerInput, type EngineerSignals } from '../../app/utils/engineer'

/** Build EngineerSignals from a flat set of overrides; defaults are "all fine". */
function sig(o: Partial<{
  bottomingPct: number
  faf: number
  raf: number
  fl: number
  fr: number
  rl: number
  rr: number
  throttleFrames: number
  tfl: number
  tfr: number
  trl: number
  trr: number
  revPct: number
  rearInner: number
  rearOuter: number
  diffSamples: number
}> = {}): EngineerSignals {
  return {
    suspensionTravel: { bottomingPct: o.bottomingPct ?? 0 },
    slipAngle: { frontAvg: o.faf ?? 0.05, rearAvg: o.raf ?? 0.05 },
    slipRatio: {
      fl: o.fl ?? 0.02, fr: o.fr ?? 0.02, rl: o.rl ?? 0.02, rr: o.rr ?? 0.02,
      throttleFrames: o.throttleFrames ?? 100
    },
    tireTempC: { fl: o.tfl ?? 90, fr: o.tfr ?? 90, rl: o.trl ?? 90, rr: o.trr ?? 90 },
    gear: { atRevLimitPct: o.revPct ?? 0 },
    diffBias: {
      rearInner: o.rearInner ?? 0,
      rearOuter: o.rearOuter ?? 0,
      frontInner: 0,
      frontOuter: 0,
      samples: o.diffSamples ?? 0
    }
  }
}

function input(signals: EngineerSignals, over: Partial<EngineerInput> = {}): EngineerInput {
  return { drivetrain: 'rwd', lapCount: 2, signals, ...over }
}

describe('analyzeCar', () => {
  it('reports no data when there are no laps', () => {
    const r = analyzeCar(input(sig(), { lapCount: 0 }))
    expect(r.hasData).toBe(false)
    expect(r.headline).toBeNull()
    expect(r.findings).toHaveLength(0)
  })

  it('reports no data for null input', () => {
    expect(analyzeCar(null).hasData).toBe(false)
  })

  it('gives an all-clear when the car is balanced', () => {
    const r = analyzeCar(input(sig()))
    expect(r.hasData).toBe(true)
    expect(r.findings).toHaveLength(0)
    expect(r.headline).toBeNull()
    expect(r.allClear.length).toBeGreaterThan(0)
  })

  it('detects strong understeer and points at the front ARB', () => {
    const r = analyzeCar(input(sig({ faf: 0.07, raf: 0.05 })))
    expect(r.headline?.id).toBe('understeer')
    expect(r.headline?.severity).toBe('high')
    expect(r.headline?.slug).toBe('anti-roll-bars')
  })

  it('detects oversteer', () => {
    const r = analyzeCar(input(sig({ faf: 0.05, raf: 0.07 })))
    expect(r.headline?.id).toBe('oversteer')
    expect(r.findings.some(f => f.id === 'oversteer')).toBe(true)
  })

  it('prioritises bottoming above a balance problem', () => {
    const r = analyzeCar(input(sig({ bottomingPct: 0.1, faf: 0.07, raf: 0.05 })))
    expect(r.headline?.id).toBe('bottoming')
    // the understeer finding is still reported, just ranked lower
    expect(r.findings.some(f => f.id === 'understeer')).toBe(true)
  })

  it('flags wheelspin but stays non-committal without cornering data', () => {
    const r = analyzeCar(input(sig({ rl: 0.4, rr: 0.4 })))
    const traction = r.findings.find(f => f.id === 'traction')
    expect(traction).toBeDefined()
    // no diff-bias samples → do not blame the differential
    expect(traction?.slug).toBe('tire-pressure')
  })

  it('blames the differential only when the INNER wheel dominates', () => {
    const r = analyzeCar(input(sig({ rl: 0.4, rr: 0.4, rearInner: 20, rearOuter: 2, diffSamples: 22 })))
    const traction = r.findings.find(f => f.id === 'traction')
    expect(traction?.slug).toBe('differential')
    expect(traction?.title).toContain('open differential')
  })

  it('calls it grip-limited (not diff) when both wheels spin together', () => {
    const r = analyzeCar(input(sig({ rl: 0.4, rr: 0.4, rearInner: 11, rearOuter: 10, diffSamples: 21 })))
    const traction = r.findings.find(f => f.id === 'traction')
    expect(traction?.slug).toBe('tire-pressure')
    expect(traction?.title).toContain('grip limited')
  })

  it('flags cold tyres as a low-severity finding', () => {
    const r = analyzeCar(input(sig({ tfl: 60, tfr: 60, trl: 60, trr: 60 })))
    const cold = r.findings.find(f => f.id === 'tyre-cold')
    expect(cold?.severity).toBe('low')
    expect(cold?.slug).toBe('tire-pressure')
  })
})
