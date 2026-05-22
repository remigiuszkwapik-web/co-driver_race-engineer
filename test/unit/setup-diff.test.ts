import { describe, expect, it } from 'vitest'
import { diffSetup } from '../../app/utils/setup-diff'
import type { BuildSettings } from '../../app/utils/build-fields'
import type { TuneSettings } from '../../app/utils/tune-fields'

describe('diffSetup', () => {
  it('returns empty for identical setups', () => {
    const setup = {
      build: { power: 620, weight: 1320 } as BuildSettings,
      tune: { springsFront: 950, brakeBalance: 54 } as TuneSettings
    }
    expect(diffSetup(setup, setup)).toEqual([])
  })

  it('returns empty when both sides are completely null', () => {
    expect(diffSetup({ build: null, tune: null }, { build: null, tune: null })).toEqual([])
  })

  it('skips fields where both sides are nullish (different representations)', () => {
    const current = { build: { power: 620 } as BuildSettings, tune: null }
    const prior = { build: { power: 620, weight: undefined } as BuildSettings, tune: null }
    expect(diffSetup(current, prior)).toEqual([])
  })

  it('detects a single changed build field', () => {
    const current = { build: { power: 620 } as BuildSettings, tune: null }
    const prior = { build: { power: 598 } as BuildSettings, tune: null }
    const rows = diffSetup(current, prior)
    expect(rows.length).toBe(1)
    expect(rows[0]!.source).toBe('build')
    expect(rows[0]!.fieldId).toBe('power')
    expect(rows[0]!.currentValue).toContain('620')
    expect(rows[0]!.priorValue).toContain('598')
  })

  it('detects a single changed tune field', () => {
    const current = { build: null, tune: { springsFront: 1020 } as TuneSettings }
    const prior = { build: null, tune: { springsFront: 850 } as TuneSettings }
    const rows = diffSetup(current, prior)
    expect(rows.length).toBe(1)
    expect(rows[0]!.source).toBe('tune')
    expect(rows[0]!.fieldId).toBe('springsFront')
  })

  it('handles null on one side as a change', () => {
    const current = { build: { weight: 1320 } as BuildSettings, tune: null }
    const prior = { build: { weight: null } as BuildSettings, tune: null }
    const rows = diffSetup(current, prior)
    expect(rows.length).toBe(1)
    expect(rows[0]!.fieldId).toBe('weight')
    expect(rows[0]!.priorValue).toBe('—')
    expect(rows[0]!.currentValue).toContain('1320')
  })

  it('groups build then tune in the output order', () => {
    const current = {
      build: { power: 620 } as BuildSettings,
      tune: { brakeBalance: 54 } as TuneSettings
    }
    const prior = {
      build: { power: 598 } as BuildSettings,
      tune: { brakeBalance: 50 } as TuneSettings
    }
    const rows = diffSetup(current, prior)
    expect(rows.length).toBe(2)
    expect(rows[0]!.source).toBe('build')
    expect(rows[1]!.source).toBe('tune')
  })

  it('returns multiple rows across cross-cutting changes', () => {
    const current = {
      build: { power: 620, weight: 1320, tireCompound: 'race' } as BuildSettings,
      tune: { springsFront: 1020, springsRear: 1100, arbFront: 28 } as TuneSettings
    }
    const prior = {
      build: { power: 598, weight: 1320, tireCompound: 'sport' } as BuildSettings,
      tune: { springsFront: 850, springsRear: 900, arbFront: 32 } as TuneSettings
    }
    const rows = diffSetup(current, prior)
    // power + tireCompound (build) + springsFront + springsRear + arbFront (tune) = 5
    expect(rows.length).toBe(5)
    const ids = rows.map(r => r.fieldId)
    expect(ids).toContain('power')
    expect(ids).toContain('tireCompound')
    expect(ids).toContain('springsFront')
    expect(ids).toContain('springsRear')
    expect(ids).toContain('arbFront')
  })

  it('skips empty-string values (treats as nullish)', () => {
    const current = { build: { notes: 'updated' } as BuildSettings, tune: null }
    const prior = { build: { notes: '' } as BuildSettings, tune: null }
    const rows = diffSetup(current, prior)
    expect(rows.length).toBe(1)
    expect(rows[0]!.fieldId).toBe('notes')
  })
})
