import { describe, expect, it } from 'vitest'
import {
  CLASS_LETTERS,
  carClassLetter,
  classForDisplay,
  classFromPi
} from '../../app/utils/class'

describe('CLASS_LETTERS (FH6 game CarClass integer → letter)', () => {
  it('maps the FH6 order, with 6=R and 7=X', () => {
    // FH6 added R as the seventh tier and shifted X to 7 (issue #22).
    expect(CLASS_LETTERS).toEqual(['D', 'C', 'B', 'A', 'S1', 'S2', 'R', 'X'])
    expect(carClassLetter(6)).toBe('R')
    expect(carClassLetter(7)).toBe('X')
    expect(carClassLetter(0)).toBe('D')
  })

  it('returns ? for out-of-range integers', () => {
    expect(carClassLetter(8)).toBe('?')
    expect(carClassLetter(-1)).toBe('?')
  })
})

describe('classFromPi (PI → letter, FH6 caps)', () => {
  it('maps each band by its inclusive upper bound', () => {
    expect(classFromPi(500)).toBe('D')
    expect(classFromPi(501)).toBe('C')
    expect(classFromPi(600)).toBe('C')
    expect(classFromPi(700)).toBe('B')
    expect(classFromPi(800)).toBe('A')
    expect(classFromPi(900)).toBe('S1')
    expect(classFromPi(998)).toBe('S2')
  })

  it('returns X above the S2 cap and never produces R', () => {
    expect(classFromPi(999)).toBe('X')
    expect(classFromPi(1000)).toBe('X')
    // R has no PI band — it can only come from the game class.
    expect(classFromPi(992)).not.toBe('R')
  })

  it('returns ? for non-finite or non-positive PI', () => {
    expect(classFromPi(0)).toBe('?')
    expect(classFromPi(-1)).toBe('?')
    expect(classFromPi(NaN)).toBe('?')
  })
})

describe('classForDisplay (PI + game class)', () => {
  it('shows R for a game R car even when PI lands in the S2 band (issue #22)', () => {
    // The reporter's PI-992 R car previously showed S2.
    expect(classForDisplay(992, 6)).toBe('R')
  })

  it('shows X for a game X car', () => {
    expect(classForDisplay(999, 7)).toBe('X')
    // Game class wins even if PI is mid-range / missing.
    expect(classForDisplay(850, 7)).toBe('X')
  })

  it('uses PI as the source of truth for D..S2', () => {
    expect(classForDisplay(992, 5)).toBe('S2')
    expect(classForDisplay(750, 3)).toBe('A')
  })

  it('falls back to the game class when PI is missing/invalid', () => {
    expect(classForDisplay(null, 4)).toBe('S1')
    expect(classForDisplay(undefined, 0)).toBe('D')
    expect(classForDisplay(null, null)).toBe('?')
  })
})
