import { describe, expect, it } from 'vitest'
import {
  buildGearingGrid,
  emptyGearingState,
  ingestGearingFrame,
  snapshotGearing
} from '../../app/utils/gearing'
import type { GearingModel } from '../../app/utils/gearing'
import type { DynoCurve } from '../../app/utils/dyno'
import type { Quad, Telemetry } from '../../server/utils/decode'

const RPM_TO_RADS = Math.PI / 30

function quad(v: number): Quad {
  return { fl: v, fr: v, rl: v, rr: v }
}

/**
 * Frame fixture for a steady pull in one gear. `ratio` and `radius` define the
 * synthetic drivetrain; wheel rotation is back-computed so the deriver should
 * recover exactly those values. RWD by default.
 */
function gearFrame(opts: {
  gear: number
  rpm: number
  ratio: number
  radius?: number
  drivetrain?: number
  clutch?: number
  slip?: number
  torque?: number
}): Telemetry {
  const radius = opts.radius ?? 0.3
  const drivetrain = opts.drivetrain ?? 1
  const wWheel = (opts.rpm * RPM_TO_RADS) / opts.ratio
  const speedKmh = wWheel * radius * 3.6
  return {
    gear: opts.gear,
    rpm: opts.rpm,
    rpmIdle: 800,
    rpmMax: 8000,
    clutch: opts.clutch ?? 0,
    throttle: 1,
    speedKmh,
    torque: opts.torque ?? 400,
    power: 0,
    wheelRotation: quad(wWheel),
    slipRatio: quad(opts.slip ?? 0),
    car: { ordinal: 1, class: 5, pi: 800, drivetrain, cylinders: 8 }
  } as Telemetry
}

describe('ingestGearingFrame / snapshotGearing', () => {
  it('recovers the combined ratio and rolling radius from clean frames', () => {
    const state = emptyGearingState()
    for (let i = 0; i < 6; i++) {
      ingestGearingFrame(state, gearFrame({ gear: 3, rpm: 5000, ratio: 8, radius: 0.31 }))
    }
    const model = snapshotGearing(state)
    expect(model.gears).toHaveLength(1)
    expect(model.gears[0]!.gear).toBe(3)
    expect(model.gears[0]!.ratio).toBeCloseTo(8, 5)
    expect(model.tireRadiusM).toBeCloseTo(0.31, 5)
    expect(model.drivetrain).toBe(1)
  })

  it('ignores frames with a slipping clutch, neutral, or reverse', () => {
    const state = emptyGearingState()
    ingestGearingFrame(state, gearFrame({ gear: 3, rpm: 5000, ratio: 8, clutch: 0.5 }))
    ingestGearingFrame(state, gearFrame({ gear: 11, rpm: 5000, ratio: 8 })) // neutral mid-shift
    ingestGearingFrame(state, gearFrame({ gear: 0, rpm: 5000, ratio: 8 })) // reverse
    expect(snapshotGearing(state).gears).toHaveLength(0)
  })

  it('does not trust a gear below the minimum sample count', () => {
    const state = emptyGearingState()
    ingestGearingFrame(state, gearFrame({ gear: 2, rpm: 4000, ratio: 10 }))
    ingestGearingFrame(state, gearFrame({ gear: 2, rpm: 4000, ratio: 10 }))
    expect(snapshotGearing(state).gears).toHaveLength(0)
  })

  it('recovers ratio under wheelspin but skips the radius read', () => {
    const state = emptyGearingState()
    // Driven (rear) wheels spin fast; speed is set independently so the radius
    // read would be wrong — slip gate must reject it. Ratio still holds.
    for (let i = 0; i < 6; i++) {
      const f = gearFrame({ gear: 2, rpm: 6000, ratio: 12, slip: 0.4 })
      ingestGearingFrame(state, f)
    }
    const model = snapshotGearing(state)
    expect(model.gears[0]!.ratio).toBeCloseTo(12, 5)
    expect(model.tireRadiusM).toBeNull() // every radius sample slip-gated out
  })

  it('is a no-op without the FH6 wheelRotation channel', () => {
    const state = emptyGearingState()
    const f = gearFrame({ gear: 3, rpm: 5000, ratio: 8 })
    ingestGearingFrame(state, { ...f, wheelRotation: null } as Telemetry)
    expect(snapshotGearing(state).gears).toHaveLength(0)
  })
})

describe('buildGearingGrid', () => {
  const dyno: DynoCurve = {
    buckets: [
      { rpm: 2000, maxTorqueNm: 300, maxPowerKw: 63, maxBoostAtm: 0, samples: 5 },
      { rpm: 4000, maxTorqueNm: 400, maxPowerKw: 168, maxBoostAtm: 0, samples: 5 },
      { rpm: 6000, maxTorqueNm: 350, maxPowerKw: 220, maxBoostAtm: 0, samples: 5 }
    ],
    peakTorque: { rpm: 4000, value: 400 },
    peakPower: { rpm: 6000, value: 220 },
    peakBoost: null,
    rpmIdle: 800,
    rpmMax: 6500
  }

  const model: GearingModel = {
    gears: [
      { gear: 1, ratio: 12, samples: 20 },
      { gear: 2, ratio: 8, samples: 20 }
    ],
    tireRadiusM: 0.3,
    drivetrain: 1
  }

  /** Find the grid index whose speed is closest to `kmh`. */
  function idxAt(grid: ReturnType<typeof buildGearingGrid>, kmh: number): number {
    let best = 0
    for (let i = 1; i < grid.speedsKmh.length; i++) {
      if (Math.abs(grid.speedsKmh[i]! - kmh) < Math.abs(grid.speedsKmh[best]! - kmh)) best = i
    }
    return best
  }

  it('shares one ascending speed axis across all gear series', () => {
    const grid = buildGearingGrid(dyno, model, { stepKmh: 1 })
    expect(grid.hasForce).toBe(true)
    expect(grid.series).toHaveLength(2)
    expect(grid.speedsKmh[0]).toBe(0)
    // Every series is sampled on the same grid.
    for (const s of grid.series) {
      expect(s.force).toHaveLength(grid.speedsKmh.length)
      expect(s.power).toHaveLength(grid.speedsKmh.length)
      expect(s.rpm).toHaveLength(grid.speedsKmh.length)
    }
  })

  it('nulls out speeds outside a gear\'s rpm range, fills inside it', () => {
    const grid = buildGearingGrid(dyno, model, { stepKmh: 1 })
    const g1 = grid.series[0]!
    // At very low speed gear 1 is below its lowest measured rpm → gap.
    expect(g1.force[0]).toBeNull()
    // Somewhere it must be populated.
    expect(g1.force.some(v => v !== null)).toBe(true)
  })

  it('force = torque(rpm) · ratio / radius at every populated grid point', () => {
    const grid = buildGearingGrid(dyno, model, { stepKmh: 0.5 })
    const radius = 0.3
    // Near gear 1 @ ~4000 rpm — between the 2000 (300 Nm) and 4000 (400 Nm) buckets.
    const wEngine = 4000 * (Math.PI / 30)
    const speedKmh = ((wEngine / 12) * radius) * 3.6
    const i = idxAt(grid, speedKmh)
    const r = grid.series[0]!.rpm[i]!
    const expTorque = 300 + ((r - 2000) / (4000 - 2000)) * (400 - 300)
    expect(grid.series[0]!.force[i]).toBeCloseTo((expTorque * 12) / radius, 2)
  })

  it('puts a higher gear at a higher speed for equal rpm (≈4000)', () => {
    const grid = buildGearingGrid(dyno, model, { stepKmh: 1 })
    const rpmNear = (s: number[], rpm: (number | null)[], target: number) => {
      let best = -1
      for (let i = 0; i < rpm.length; i++) {
        if (rpm[i] === null) continue
        if (best < 0 || Math.abs(rpm[i]! - target) < Math.abs(rpm[best]! - target)) best = i
      }
      return s[best]!
    }
    const g1Speed = rpmNear(grid.speedsKmh, grid.series[0]!.rpm, 4000)
    const g2Speed = rpmNear(grid.speedsKmh, grid.series[1]!.rpm, 4000)
    expect(g2Speed).toBeGreaterThan(g1Speed)
  })

  it('falls back to power-only when torque is unavailable', () => {
    const grid = buildGearingGrid({ ...dyno, peakTorque: null }, model)
    expect(grid.hasForce).toBe(false)
  })
})
