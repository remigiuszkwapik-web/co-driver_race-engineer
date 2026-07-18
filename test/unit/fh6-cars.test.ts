import { describe, expect, it } from 'vitest'
import { fh6CarName } from '../../app/utils/fh6-cars'

describe('fh6CarName', () => {
  it('resolves a known ordinal to its name', () => {
    expect(fh6CarName(1513)).toBe('Maserati Ghibli Cup')
  })

  it('returns null for an unknown ordinal', () => {
    expect(fh6CarName(999999)).toBeNull()
  })

  it('returns null for null/undefined', () => {
    expect(fh6CarName(null)).toBeNull()
    expect(fh6CarName(undefined)).toBeNull()
  })
})
