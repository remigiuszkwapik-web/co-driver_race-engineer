import { describe, expect, it } from 'vitest'
import { pushSample, type TraceSample } from '../../app/utils/trace'

function sample(t: number): TraceSample {
  return { t, throttle: 0, brake: 0, steer: 0, yawRate: 0 }
}

describe('pushSample', () => {
  it('appends when under the cap', () => {
    const h: TraceSample[] = []
    pushSample(h, sample(1), 3)
    pushSample(h, sample(2), 3)
    expect(h.map(s => s.t)).toEqual([1, 2])
  })

  it('evicts oldest when at cap', () => {
    const h: TraceSample[] = []
    for (let i = 1; i <= 5; i++) pushSample(h, sample(i), 3)
    expect(h.map(s => s.t)).toEqual([3, 4, 5])
  })

  it('returns the same array reference (mutates in place)', () => {
    const h: TraceSample[] = []
    const out = pushSample(h, sample(1), 3)
    expect(out).toBe(h)
  })
})
