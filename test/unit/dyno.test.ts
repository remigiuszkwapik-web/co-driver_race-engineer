import { describe, expect, it } from 'vitest'
import {
  binFrames,
  emptyDynoState,
  ingestFrame,
  powerbandRange,
  snapshot
} from '../../app/utils/dyno'
import type { Telemetry } from '../../server/utils/decode'

/**
 * Minimal Telemetry fixture. The dyno helper only reads rpm/rpmIdle/throttle/
 * torque/power, so we cast a thin partial to Telemetry — saves filling all
 * twenty-something other fields per test.
 */
function frame(overrides: Partial<Telemetry> = {}): Telemetry {
  return {
    rpm: 0,
    rpmIdle: 800,
    rpmMax: 8000,
    throttle: 1,
    torque: 0,
    power: 0,
    ...overrides
  } as Telemetry
}

describe('binFrames', () => {
  it('returns empty curve for empty input', () => {
    const curve = binFrames([])
    expect(curve.buckets).toEqual([])
    expect(curve.peakTorque).toBeNull()
    expect(curve.peakPower).toBeNull()
    expect(curve.rpmIdle).toBe(700) // fallback constant
    expect(curve.rpmMax).toBe(0)
  })

  it('excludes frames below the WOT threshold', () => {
    const curve = binFrames([
      frame({ rpm: 4000, throttle: 0.5, torque: 999, power: 999000 }),
      frame({ rpm: 4000, throttle: 0.8, torque: 999, power: 999000 })
    ])
    expect(curve.buckets).toEqual([])
    expect(curve.peakTorque).toBeNull()
    // Axis-sizing facts still get tracked even from gated frames
    expect(curve.rpmMax).toBe(4000)
    expect(curve.rpmIdle).toBe(800)
  })

  it('builds buckets and identifies peaks on a fake WOT pull', () => {
    // Fake pull from 2000 → 7000 RPM, torque peaks around 4000, power around 6000
    const frames: Telemetry[] = []
    for (let rpm = 2000; rpm <= 7000; rpm += 100) {
      // Triangular torque curve peaking at 4000 with value 500 Nm
      const torque = 500 - Math.abs(rpm - 4000) * 0.05
      // Power = torque * rpm * conversion; rises through the rev range, peaks late
      const power = torque * rpm * 0.1047 // ~Watts unit, just need monotonic shape
      frames.push(frame({ rpm, torque, power, throttle: 1 }))
    }
    const curve = binFrames(frames)

    expect(curve.buckets.length).toBeGreaterThan(0)
    expect(curve.peakTorque).not.toBeNull()
    expect(curve.peakPower).not.toBeNull()
    // Peak torque around 4000 RPM (within one bin of the synthetic peak)
    expect(curve.peakTorque!.rpm).toBeGreaterThanOrEqual(3800)
    expect(curve.peakTorque!.rpm).toBeLessThanOrEqual(4200)
    // Power peaks later than torque — the engine-physics check from the plan
    expect(curve.peakPower!.rpm).toBeGreaterThan(curve.peakTorque!.rpm)
  })

  it('tracks rpmIdle from frame data and rpmMax from observed RPMs', () => {
    const curve = binFrames([
      frame({ rpm: 1000, rpmIdle: 950, throttle: 1, torque: 100, power: 50000 }),
      frame({ rpm: 5500, rpmIdle: 950, throttle: 1, torque: 400, power: 200000 }),
      frame({ rpm: 3000, rpmIdle: 950, throttle: 1, torque: 350, power: 150000 })
    ])
    expect(curve.rpmIdle).toBe(950)
    expect(curve.rpmMax).toBe(5500)
  })

  it('honors a custom binWidth', () => {
    const curve = binFrames(
      [
        frame({ rpm: 4050, torque: 100, power: 50000, throttle: 1 }),
        frame({ rpm: 4150, torque: 200, power: 80000, throttle: 1 })
      ],
      { binWidth: 100 }
    )
    // Two distinct bins at 100-RPM resolution
    expect(curve.buckets.length).toBe(2)
    // Same data at 1000-RPM resolution collapses to one
    const wider = binFrames(
      [
        frame({ rpm: 4050, torque: 100, power: 50000, throttle: 1 }),
        frame({ rpm: 4150, torque: 200, power: 80000, throttle: 1 })
      ],
      { binWidth: 1000 }
    )
    expect(wider.buckets.length).toBe(1)
    expect(wider.buckets[0]!.maxTorqueNm).toBe(200) // max preserved
    expect(wider.buckets[0]!.samples).toBe(2)
  })
})

describe('streaming accumulator', () => {
  it('emptyDynoState produces a snapshot equivalent to an empty curve', () => {
    expect(snapshot(emptyDynoState()).buckets).toEqual([])
  })

  it('ingestFrame accumulates across multiple calls', () => {
    const state = emptyDynoState()
    ingestFrame(state, frame({ rpm: 3000, torque: 300, power: 100000, throttle: 1 }))
    ingestFrame(state, frame({ rpm: 3050, torque: 320, power: 110000, throttle: 1 })) // same bin
    ingestFrame(state, frame({ rpm: 5000, torque: 280, power: 180000, throttle: 1 }))
    const curve = snapshot(state)
    expect(curve.buckets.length).toBe(2)
    expect(curve.peakTorque!.rpm).toBe(3000) // bin centre of 3000 + 3050
    expect(curve.peakTorque!.value).toBe(320)
    expect(curve.peakPower!.rpm).toBe(5000)
  })

  it('can be reset by replacing the state — supports the page-level car-change path', () => {
    // The page watches frame.car.ordinal and reassigns to emptyDynoState() —
    // verify that the helper API supports that without any "reset" function.
    let state = emptyDynoState()
    ingestFrame(state, frame({ rpm: 4000, torque: 500, power: 200000, throttle: 1 }))
    expect(snapshot(state).buckets.length).toBe(1)

    state = emptyDynoState() // simulate car change
    expect(snapshot(state).buckets.length).toBe(0)

    ingestFrame(state, frame({ rpm: 4000, torque: 150, power: 60000, throttle: 1 }))
    expect(snapshot(state).peakTorque!.value).toBe(150) // not polluted by previous car
  })
})

describe('powerbandRange', () => {
  it('returns null for an empty curve', () => {
    expect(powerbandRange(binFrames([]))).toBeNull()
  })

  it('finds the RPM range where torque is within threshold of peak', () => {
    // Bins at 1000-step ratchet: torque rises to peak at 4000, falls off
    const frames = [
      frame({ rpm: 2000, torque: 300, power: 60000, throttle: 1 }),
      frame({ rpm: 3000, torque: 450, power: 100000, throttle: 1 }),
      frame({ rpm: 4000, torque: 500, power: 180000, throttle: 1 }), // peak torque
      frame({ rpm: 5000, torque: 460, power: 220000, throttle: 1 }),
      frame({ rpm: 6000, torque: 300, power: 200000, throttle: 1 })
    ]
    const curve = binFrames(frames, { binWidth: 1000 })
    // Threshold 0.9: torque ≥ 450 — bins at 3000, 4000, 5000 qualify
    const band = powerbandRange(curve, 0.9)
    expect(band).not.toBeNull()
    expect(band!.low).toBe(3000)
    expect(band!.high).toBe(5000)
  })
})
