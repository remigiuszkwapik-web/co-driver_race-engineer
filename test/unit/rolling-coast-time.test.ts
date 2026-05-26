import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Telemetry } from '../../server/utils/decode'
import { forzaBus, type MeasurementEvent } from '../../server/utils/forza-bus'
import { RollingCoastTime } from '../../server/utils/rolling-coast-time'

interface FrameInput {
  throttle: number
  brake: number
  steer: number
  timestampMs: number
  isRaceOn?: boolean
}

function makeFrame(opts: FrameInput): Telemetry {
  return {
    isRaceOn: opts.isRaceOn ?? true,
    timestampMs: opts.timestampMs,
    throttle: opts.throttle,
    brake: opts.brake,
    steer: opts.steer,
    rpm: 0,
    rpmMax: 0,
    torque: 0,
    power: 0,
    speed: 0,
    angularVelocity: { x: 0, y: 0, z: 0 },
    accelLat: 0,
    accelLong: 0,
    lap: { number: 0, racePosition: 1, current: 0, last: 0, best: 0, raceTime: 0, distance: 0 },
    car: { ordinal: 12345, class: 800, pi: 745, drivetrain: 0, cylinders: 4 }
  } as unknown as Telemetry
}

function fresh(): { measurements: MeasurementEvent[] } {
  const measurements: MeasurementEvent[] = []
  forzaBus.on('measurement', m => measurements.push(m))
  // Side-effect: subscribes a fresh listener to 'telemetry'.
  void new RollingCoastTime()
  return { measurements }
}

beforeEach(() => {
  forzaBus.removeAllListeners('telemetry')
  forzaBus.removeAllListeners('measurement')
})

afterEach(() => {
  forzaBus.removeAllListeners('telemetry')
  forzaBus.removeAllListeners('measurement')
})

describe('RollingCoastTime', () => {
  it('emits at ~5 Hz cadence (one measurement per 12 frames at 60 Hz)', () => {
    const { measurements } = fresh()
    for (let i = 0; i < 24; i++) {
      forzaBus.emit('telemetry', makeFrame({ throttle: 0, brake: 0, steer: 0.3, timestampMs: i * 16 }))
    }
    expect(measurements).toHaveLength(2)
    expect(measurements[0]!.name).toBe('time_coast')
  })

  it('reports the window bounds as the oldest/newest frame timestamps', () => {
    const { measurements } = fresh()
    for (let i = 0; i < 12; i++) {
      forzaBus.emit('telemetry', makeFrame({ throttle: 0, brake: 0, steer: 0.3, timestampMs: 1000 + i * 16 }))
    }
    expect(measurements).toHaveLength(1)
    expect(measurements[0]!.startMs).toBe(1000)
    expect(measurements[0]!.endMs).toBe(1000 + 11 * 16)
  })

  it('value is 1.0 when every frame in the window satisfies the coast predicate', () => {
    const { measurements } = fresh()
    for (let i = 0; i < 12; i++) {
      forzaBus.emit('telemetry', makeFrame({ throttle: 0, brake: 0, steer: 0.3, timestampMs: i * 16 }))
    }
    expect(measurements[0]!.value).toBe(1)
  })

  it('value is 0 (not NaN) when the window has no qualifying frames', () => {
    const { measurements } = fresh()
    // 12 frames at full throttle — never coasting.
    for (let i = 0; i < 12; i++) {
      forzaBus.emit('telemetry', makeFrame({ throttle: 1.0, brake: 0, steer: 0.3, timestampMs: i * 16 }))
    }
    expect(measurements[0]!.value).toBe(0)
  })

  it('steer filter rejects straight-line lift (off both pedals but |steer| ≤ 0.1)', () => {
    const { measurements } = fresh()
    // Both pedals released, but going straight — should NOT count as coast.
    for (let i = 0; i < 12; i++) {
      forzaBus.emit('telemetry', makeFrame({ throttle: 0, brake: 0, steer: 0, timestampMs: i * 16 }))
    }
    expect(measurements[0]!.value).toBe(0)
  })

  it('brake-pressed frames disqualify even with steer engaged', () => {
    const { measurements } = fresh()
    for (let i = 0; i < 12; i++) {
      // Brake above the 0.05 threshold — not a coast frame.
      forzaBus.emit('telemetry', makeFrame({ throttle: 0, brake: 0.2, steer: 0.3, timestampMs: i * 16 }))
    }
    expect(measurements[0]!.value).toBe(0)
  })

  it('value reflects the mix of coasting and non-coasting frames in the window', () => {
    const { measurements } = fresh()
    // 60 frames coast (T=0, B=0, S=0.3), then 60 frames on-throttle (T=0.8, B=0, S=0).
    // After 120 frames at 16ms each → window spans 1.9 s, well within the 30 s cap.
    // 120/12 = 10 emits. Last emit's window covers all 120 frames → ratio = 60/120 = 0.5.
    for (let i = 0; i < 120; i++) {
      if (i < 60) {
        forzaBus.emit('telemetry', makeFrame({ throttle: 0, brake: 0, steer: 0.3, timestampMs: i * 16 }))
      } else {
        forzaBus.emit('telemetry', makeFrame({ throttle: 0.8, brake: 0, steer: 0, timestampMs: i * 16 }))
      }
    }
    expect(measurements).toHaveLength(10)
    const last = measurements[measurements.length - 1]!
    expect(last.value).toBeCloseTo(0.5, 2)
  })

  it('skips frames where isRaceOn is false (window freezes during pause)', () => {
    const { measurements } = fresh()
    // 11 live frames — counter at 11, no emit yet.
    for (let i = 0; i < 11; i++) {
      forzaBus.emit('telemetry', makeFrame({ throttle: 0, brake: 0, steer: 0.3, timestampMs: i * 16, isRaceOn: true }))
    }
    expect(measurements).toHaveLength(0)
    // 20 paused frames — must not advance the counter.
    for (let i = 11; i < 31; i++) {
      forzaBus.emit('telemetry', makeFrame({ throttle: 0, brake: 0, steer: 0.3, timestampMs: i * 16, isRaceOn: false }))
    }
    expect(measurements).toHaveLength(0)
    // 1 more live frame → counter hits 12 → emit.
    forzaBus.emit('telemetry', makeFrame({ throttle: 0, brake: 0, steer: 0.3, timestampMs: 31 * 16, isRaceOn: true }))
    expect(measurements).toHaveLength(1)
  })

  it('clears the window on a large backwards timestamp jump (race-to-race transition)', () => {
    const { measurements } = fresh()
    for (let i = 0; i < 12; i++) {
      forzaBus.emit('telemetry', makeFrame({ throttle: 0, brake: 0, steer: 0.3, timestampMs: 10_000 + i * 16 }))
    }
    expect(measurements).toHaveLength(1)
    expect(measurements[0]!.startMs).toBe(10_000)
    // Backwards jump well past the 1-second tolerance.
    for (let i = 0; i < 12; i++) {
      forzaBus.emit('telemetry', makeFrame({ throttle: 0, brake: 0, steer: 0.3, timestampMs: 5000 + i * 16 }))
    }
    expect(measurements).toHaveLength(2)
    expect(measurements[1]!.startMs).toBe(5000)
  })
})
