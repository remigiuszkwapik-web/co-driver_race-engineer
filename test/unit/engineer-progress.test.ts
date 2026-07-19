import { describe, expect, it } from 'vitest'
import {
  progressHints,
  summarizeSession,
  type SessionSummary
} from '../../app/utils/engineer-progress'
import type { FrameAggregates } from '../../app/utils/tune-signals'

function sess(o: Partial<SessionSummary> = {}): SessionSummary {
  return {
    lapCount: 5,
    bestLapMs: 72000,
    drivenSlip: 0.37,
    innerRatio: 3.9,
    drivenTempC: 69,
    balance: 0,
    ...o
  }
}

describe('progressHints', () => {
  it('no comparison without a current session', () => {
    expect(progressHints(null, sess()).hasComparison).toBe(false)
  })

  it('notes a first session when there is nothing to compare', () => {
    const r = progressHints(sess(), null)
    expect(r.hasComparison).toBe(false)
    expect(r.note).toContain('First recorded session')
  })

  it('reports a faster best lap as better', () => {
    const r = progressHints(sess({ bestLapMs: 71500 }), sess({ bestLapMs: 72000 }))
    const lap = r.hints.find(h => h.id === 'lap')
    expect(lap?.direction).toBe('better')
    expect(lap?.text).toContain('faster')
  })

  it('reports falling wheelspin as better', () => {
    const r = progressHints(sess({ drivenSlip: 0.37 }), sess({ drivenSlip: 0.49 }))
    expect(r.hints.find(h => h.id === 'wheelspin')?.direction).toBe('better')
  })

  it('reports easing inner-wheel spin as better', () => {
    const r = progressHints(sess({ innerRatio: 3.9 }), sess({ innerRatio: 8 }))
    const b = r.hints.find(h => h.id === 'diff-bias')
    expect(b?.direction).toBe('better')
    expect(b?.text).toContain('8.0:1')
  })

  it('calls tyres warming toward the window an improvement', () => {
    const r = progressHints(sess({ drivenTempC: 69 }), sess({ drivenTempC: 62 }))
    const t = r.hints.find(h => h.id === 'tyre-temp')
    expect(t?.direction).toBe('better')
    expect(t?.text).toContain('closer to the window')
  })

  it('says nothing changed when the session is the same', () => {
    const r = progressHints(sess(), sess())
    expect(r.hints).toHaveLength(0)
    expect(r.note).toContain('about the same')
  })
})

describe('summarizeSession', () => {
  it('reads the driven (rear) axle for a RWD car', () => {
    const signals = {
      slipRatio: { fl: 0.05, fr: 0.05, rl: 0.4, rr: 0.3, throttleFrames: 100 },
      tireTempC: { fl: 80, fr: 80, rl: 70, rr: 68, allOptimalPct: 0 },
      diffBias: { rearInner: 40, rearOuter: 10, frontInner: 0, frontOuter: 0, samples: 50 },
      slipAngle: { frontAvg: 0.06, rearAvg: 0.05 }
    } as unknown as FrameAggregates

    const s = summarizeSession(signals, 'rwd', 71000, 4)
    expect(s.drivenSlip).toBeCloseTo(0.35)
    expect(s.drivenTempC).toBeCloseTo(69)
    expect(s.innerRatio).toBeCloseTo(4)
    expect(s.balance).toBeCloseTo(0.01)
    expect(s.bestLapMs).toBe(71000)
  })
})
