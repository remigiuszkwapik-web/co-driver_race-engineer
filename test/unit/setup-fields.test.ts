import { describe, expect, it } from 'vitest'
import {
  BUILD_FIELDS,
  formatFieldValue,
  getBuildField,
  type SetupField
} from '../../app/utils/setup-fields'

describe('BUILD_FIELDS metadata', () => {
  it('every field has id + label + section + kind', () => {
    for (const f of BUILD_FIELDS) {
      expect(f.id).toBeTruthy()
      expect(f.label).toBeTruthy()
      expect(f.section).toBeTruthy()
      expect(f.kind).toMatch(/^(number|enum|text)$/)
    }
  })

  it('every enum field has non-empty options', () => {
    for (const f of BUILD_FIELDS) {
      if (f.kind === 'enum') {
        expect(f.options).toBeDefined()
        expect(f.options!.length).toBeGreaterThan(0)
      }
    }
  })

  it('no duplicate field ids', () => {
    const ids = BUILD_FIELDS.map(f => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('non-enum fields do not have options', () => {
    for (const f of BUILD_FIELDS) {
      if (f.kind !== 'enum') {
        expect(f.options).toBeUndefined()
      }
    }
  })

  it('drivetrain options match telemetry conventions', () => {
    const dt = BUILD_FIELDS.find(f => f.id === 'drivetrain')!
    expect(dt.options).toEqual(['fwd', 'rwd', 'awd'])
  })

  it('carClass options cover all FH6 classes including R', () => {
    const cls = BUILD_FIELDS.find(f => f.id === 'carClass')!
    expect(cls.options).toEqual(['D', 'C', 'B', 'A', 'S1', 'S2', 'X', 'R'])
  })
})

describe('getBuildField', () => {
  it('finds an existing field', () => {
    expect(getBuildField('power')?.label).toBe('Power')
  })

  it('returns undefined for unknown id', () => {
    expect(getBuildField('not_a_real_field')).toBeUndefined()
  })
})

describe('formatFieldValue', () => {
  function field(overrides: Partial<SetupField> = {}): SetupField {
    return { id: 'x', label: 'X', section: 's', kind: 'number', ...overrides }
  }

  it('renders nullish values as em-dash', () => {
    const f = field()
    expect(formatFieldValue(f, null)).toBe('—')
    expect(formatFieldValue(f, undefined)).toBe('—')
    expect(formatFieldValue(f, '')).toBe('—')
  })

  it('renders numbers with units appended', () => {
    const f = field({ unit: ' HP' })
    expect(formatFieldValue(f, 612)).toBe('612 HP')
  })

  it('renders fractional numbers with one decimal', () => {
    const f = field({ unit: ' kg' })
    expect(formatFieldValue(f, 1320.4)).toBe('1320.4 kg')
  })

  it('falls back to "—" for non-numeric in number fields', () => {
    expect(formatFieldValue(field(), 'banana')).toBe('—')
  })

  it('renders enum values via the dedicated label map', () => {
    const f = field({ id: 'drivetrain', kind: 'enum', options: ['fwd', 'rwd', 'awd'] })
    expect(formatFieldValue(f, 'awd')).toBe('AWD')
  })

  it('renders tire compounds with friendly names', () => {
    const f = field({ id: 'tireCompound', kind: 'enum', options: ['stock', 'semi_slick'] })
    expect(formatFieldValue(f, 'semi_slick')).toBe('Semi-slick')
  })

  it('falls back to raw enum value if not in a label map', () => {
    const f = field({ id: 'unknownEnum', kind: 'enum', options: ['foo'] })
    expect(formatFieldValue(f, 'foo')).toBe('foo')
  })

  it('renders text fields as-is', () => {
    const f = field({ kind: 'text' })
    expect(formatFieldValue(f, 'LS V8')).toBe('LS V8')
  })
})
