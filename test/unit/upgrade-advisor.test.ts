import { describe, expect, it } from 'vitest'
import { adviseUpgrades, type UpgradeInput, type UpgradeSignals } from '../../app/utils/upgrade-advisor'

function sig(o: Partial<{
  rl: number
  rr: number
  throttleFrames: number
  tfl: number
  tfr: number
  trl: number
  trr: number
}> = {}): UpgradeSignals {
  return {
    slipRatio: {
      fl: 0.02, fr: 0.02, rl: o.rl ?? 0.02, rr: o.rr ?? 0.02,
      throttleFrames: o.throttleFrames ?? 100
    },
    tireTempC: { fl: o.tfl ?? 90, fr: o.tfr ?? 90, rl: o.trl ?? 90, rr: o.trr ?? 90 },
    gear: { atRevLimitPct: 0 }
  }
}

function input(signals: UpgradeSignals, over: Partial<UpgradeInput> = {}): UpgradeInput {
  return { drivetrain: 'rwd', lapCount: 2, classLetter: 'B', signals, ...over }
}

describe('adviseUpgrades', () => {
  it('reports no data with no laps', () => {
    expect(adviseUpgrades(input(sig(), { lapCount: 0 })).hasData).toBe(false)
    expect(adviseUpgrades(null).hasData).toBe(false)
  })

  it('calls a wheelspinning car grip-limited and leads with tyres', () => {
    const r = adviseUpgrades(input(sig({ rl: 0.4, rr: 0.4 })))
    expect(r.limiter).toBe('grip')
    expect(r.recommendations[0]?.slug).toBe('tires')
    expect(r.recommendations.some(x => x.slug === 'weight')).toBe(true)
  })

  it('calls a car on cold tyres grip-limited', () => {
    const r = adviseUpgrades(input(sig({ tfl: 60, tfr: 60, trl: 60, trr: 60 })))
    expect(r.limiter).toBe('grip')
    expect(r.recommendations[0]?.slug).toBe('tires')
  })

  it('defaults to weight reduction when nothing is clearly limiting', () => {
    const r = adviseUpgrades(input(sig()))
    expect(r.limiter).toBe('balanced')
    expect(r.recommendations[0]?.slug).toBe('weight')
  })

  it('mentions the class in the note', () => {
    const r = adviseUpgrades(input(sig(), { classLetter: 'A' }))
    expect(r.note).toContain('A-class')
  })
})
