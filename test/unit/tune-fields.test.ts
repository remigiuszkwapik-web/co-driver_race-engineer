import { describe, expect, it } from 'vitest'
import {
  TUNE_FIELDS,
  TUNE_SECTIONS,
  DEFAULT_OPEN_SECTIONS,
  getTuneField,
  tuneFieldsBySection,
  visibleTuneFields
} from '../../app/utils/tune-fields'

describe('TUNE_FIELDS metadata', () => {
  it('every field has id + label + section + kind', () => {
    for (const f of TUNE_FIELDS) {
      expect(f.id).toBeTruthy()
      expect(f.label).toBeTruthy()
      expect(f.section).toBeTruthy()
      expect(f.kind).toMatch(/^(number|enum|text)$/)
    }
  })

  it('every field section is in TUNE_SECTIONS', () => {
    const sections = new Set<string>(TUNE_SECTIONS)
    for (const f of TUNE_FIELDS) {
      expect(sections.has(f.section)).toBe(true)
    }
  })

  it('no duplicate field ids', () => {
    const ids = TUNE_FIELDS.map(f => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every section appearing in TUNE_FIELDS has DEFAULT_OPEN_SECTIONS entry', () => {
    const sectionsInUse = new Set(TUNE_FIELDS.map(f => f.section))
    for (const s of sectionsInUse) {
      expect(s in DEFAULT_OPEN_SECTIONS).toBe(true)
    }
  })

  it('numeric fields with bounds have a coherent min/max/step triple', () => {
    for (const f of TUNE_FIELDS) {
      if (f.kind !== 'number') {
        expect(f.min).toBeUndefined()
        expect(f.max).toBeUndefined()
        expect(f.step).toBeUndefined()
        continue
      }
      // Fields can either declare all three bounds or leave the field
      // open (per-car ranges for springs, ride height, aero F/R).
      const hasBounds = f.min !== undefined || f.max !== undefined || f.step !== undefined
      if (hasBounds) {
        expect(f.min).toBeDefined()
        expect(f.max).toBeDefined()
        expect(f.step).toBeDefined()
        expect(f.max!).toBeGreaterThan(f.min!)
        expect(f.step!).toBeGreaterThan(0)
      }
    }
  })

  it('FH6 slider ranges (spot checks from the captured tune menu)', () => {
    const damper = getTuneField('bumpFront')!
    expect(damper.min).toBe(1)
    expect(damper.max).toBe(20)
    expect(damper.step).toBe(0.1)

    const arb = getTuneField('arbFront')!
    expect(arb.min).toBe(1)
    expect(arb.max).toBe(65)

    const camber = getTuneField('camberFront')!
    expect(camber.min).toBe(-5)
    expect(camber.max).toBe(5)

    const caster = getTuneField('casterFront')!
    expect(caster.min).toBe(1)
    expect(caster.max).toBe(7)

    const brakePressure = getTuneField('brakePressure')!
    // Confirms the >100% surprise — pressure runs 0–200%.
    expect(brakePressure.max).toBe(200)

    const finalDrive = getTuneField('finalDrive')!
    expect(finalDrive.min).toBe(2.2)
    expect(finalDrive.max).toBe(6.1)
    expect(finalDrive.step).toBe(0.01)
  })

  it('per-car-varying fields do NOT declare bounds', () => {
    for (const id of ['springsFront', 'springsRear', 'rideHeightFront', 'rideHeightRear', 'aeroFront', 'aeroRear']) {
      const f = getTuneField(id)!
      expect(f.min).toBeUndefined()
      expect(f.max).toBeUndefined()
      expect(f.step).toBeUndefined()
    }
  })
})

describe('getTuneField', () => {
  it('finds an existing field', () => {
    expect(getTuneField('springsFront')?.label).toBe('Front springs')
  })

  it('returns undefined for unknown id', () => {
    expect(getTuneField('not_a_real_field')).toBeUndefined()
  })
})

describe('drivetrain gating', () => {
  it('FWD shows front diff fields, hides rear + center', () => {
    const ids = visibleTuneFields('fwd').map(f => f.id)
    expect(ids).toContain('frontAccel')
    expect(ids).toContain('frontDecel')
    expect(ids).not.toContain('rearAccel')
    expect(ids).not.toContain('rearDecel')
    expect(ids).not.toContain('centerBalance')
  })

  it('RWD shows rear diff fields, hides front + center', () => {
    const ids = visibleTuneFields('rwd').map(f => f.id)
    expect(ids).toContain('rearAccel')
    expect(ids).toContain('rearDecel')
    expect(ids).not.toContain('frontAccel')
    expect(ids).not.toContain('frontDecel')
    expect(ids).not.toContain('centerBalance')
  })

  it('AWD shows front + rear + center diff', () => {
    const ids = visibleTuneFields('awd').map(f => f.id)
    expect(ids).toContain('frontAccel')
    expect(ids).toContain('frontDecel')
    expect(ids).toContain('rearAccel')
    expect(ids).toContain('rearDecel')
    expect(ids).toContain('centerBalance')
  })

  it('unknown drivetrain hides all gated diff fields', () => {
    const ids = visibleTuneFields(null).map(f => f.id)
    expect(ids).not.toContain('frontAccel')
    expect(ids).not.toContain('rearAccel')
    expect(ids).not.toContain('centerBalance')
  })

  it('non-diff fields are always visible regardless of drivetrain', () => {
    const fwdIds = new Set(visibleTuneFields('fwd').map(f => f.id))
    const rwdIds = new Set(visibleTuneFields('rwd').map(f => f.id))
    const awdIds = new Set(visibleTuneFields('awd').map(f => f.id))
    for (const id of ['springsFront', 'arbRear', 'brakeBalance', 'aeroFront']) {
      expect(fwdIds.has(id)).toBe(true)
      expect(rwdIds.has(id)).toBe(true)
      expect(awdIds.has(id)).toBe(true)
    }
  })
})

describe('tuneFieldsBySection', () => {
  it('groups fields under their declared sections', () => {
    const groups = tuneFieldsBySection('rwd')
    expect(groups.springs?.length).toBe(2)
    expect(groups.dampers?.length).toBe(4)
    expect(groups.arb?.length).toBe(2)
  })

  it('differential group reflects drivetrain', () => {
    expect(tuneFieldsBySection('fwd').differential?.length).toBe(2)
    expect(tuneFieldsBySection('rwd').differential?.length).toBe(2)
    expect(tuneFieldsBySection('awd').differential?.length).toBe(5)
  })
})
