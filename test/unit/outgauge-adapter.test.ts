import { describe, expect, it } from 'vitest'
import { beamngAdapter, createOutGaugeAdapter } from '../../server/adapters/outgauge'

// Build an OutGauge packet (92 bytes, little-endian).
function packet(): Buffer {
  const b = Buffer.alloc(92)
  b.writeUInt16LE(0, 8) // Flags
  b.writeUInt8(3, 10) // Gear: first(2)+1 -> our gear 2
  b.writeFloatLE(30, 12) // Speed m/s -> 108 km/h
  b.writeFloatLE(5000, 16) // RPM
  b.writeFloatLE(1.0, 20) // Turbo bar
  b.writeFloatLE(90, 24) // EngTemp
  b.writeFloatLE(0.5, 28) // Fuel
  b.writeFloatLE(0.9, 48) // Throttle
  b.writeFloatLE(0.1, 52) // Brake
  b.writeFloatLE(0.0, 56) // Clutch
  return b
}

describe('outgauge adapter (BeamNG / LFS)', () => {
  it('binds beamng to id beamng and port 4444', () => {
    expect(beamngAdapter.id).toBe('beamng')
    expect(beamngAdapter.transport).toEqual({ protocol: 'udp', defaultPort: 4444 })
  })

  it('rejects undersized packets, accepts 92 and 96 bytes', () => {
    expect(beamngAdapter.decode(Buffer.alloc(91))).toBeNull()
    expect(beamngAdapter.decode(packet())).not.toBeNull()
    expect(beamngAdapter.decode(Buffer.concat([packet(), Buffer.alloc(4)]))).not.toBeNull() // with ID
  })

  it('decodes dashboard channels', () => {
    const t = beamngAdapter.decode(packet())!
    expect(t.isRaceOn).toBe(true)
    expect(t.speedKmh).toBeCloseTo(108, 1) // 30 m/s
    expect(t.rpm).toBeCloseTo(5000, 1)
    expect(t.gear).toBe(2) // first(2) - 1
    expect(t.throttle).toBeCloseTo(0.9, 5)
    expect(t.brake).toBeCloseTo(0.1, 5)
    expect(t.clutch).toBeCloseTo(0, 5)
    expect(t.fuel).toBeCloseTo(0.5, 5)
    expect(t.rawLength).toBe(92)
  })

  it('converts turbo BAR to gauge PSI', () => {
    const t = beamngAdapter.decode(packet())!
    expect(t.boost).toBeCloseTo(14.5037738, 4) // 1 bar
  })

  it('maps gear reverse/neutral from OutGauge encoding', () => {
    const b = packet()
    b.writeUInt8(0, 10) // reverse
    expect(beamngAdapter.decode(b)!.gear).toBe(-1)
    b.writeUInt8(1, 10) // neutral
    expect(beamngAdapter.decode(b)!.gear).toBe(0)
  })

  it('zeroes the motion/lap/per-wheel channels OutGauge lacks', () => {
    const t = beamngAdapter.decode(packet())!
    expect(t.rpmMax).toBe(0)
    expect(t.steer).toBe(0)
    expect(t.position).toEqual({ x: 0, y: 0, z: 0 })
    expect(t.acceleration).toEqual({ x: 0, y: 0, z: 0 })
    expect(t.slipRatio).toEqual({ fl: 0, fr: 0, rl: 0, rr: 0 })
    expect(t.wheelRotation).toBeNull()
    expect(t.lap.number).toBe(0)
    expect(t.lap.current).toBe(0)
  })

  it('factory binds the given id/port (enables LFS reuse on a distinct port)', () => {
    const a = createOutGaugeAdapter('beamng', 30000)
    expect(a.id).toBe('beamng')
    expect(a.transport.defaultPort).toBe(30000)
  })
})
