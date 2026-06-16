import { describe, expect, it } from 'vitest'
import { dirt2Adapter } from '../../server/adapters/dirt2'

// Build a DiRT Rally 2.0 extradata=3 packet (264 bytes, 66 float32s).
// Keys are field INDICES; byte offset = index * 4.
function packet(fields: Record<number, number>): Buffer {
  const buf = Buffer.alloc(264)
  for (const [idx, val] of Object.entries(fields)) {
    buf.writeFloatLE(val, Number(idx) * 4)
  }
  return buf
}

function fullPacket(): Buffer {
  return packet({
    0: 12.5, // run_time -> timestamp 12500 ms
    1: 42.5, // lap_time -> lap.current
    2: 1234, // distance -> lap.distance
    4: 100, 5: 5, 6: -250, // pos x/y/z
    7: 50, // speed_ms -> 180 km/h
    8: 60, 9: 0, 10: 0, // vel x/y/z
    12: 0, // roll_y -> roll = 0
    14: 0, 15: 0, 16: 1, // forward = +z -> yaw 0, pitch 0
    17: 0.11, 18: 0.12, 19: 0.13, 20: 0.14, // susp RL,RR,FL,FR
    29: 1.0, // throttle
    30: -0.5, // steering
    31: 0.25, // brakes
    32: 0.75, // clutch
    33: 4, // gear
    34: 0.8, // g_force_lat
    35: -1.2, // g_force_lon
    36: 2, // current_lap
    37: 750, // rpm/10 -> 7500
    39: 3, // car_pos -> racePosition
    45: 30, // fuel_in_tank
    46: 60, // fuel_capacity
    62: 95.3, // last_lap_time
    63: 800, // max_rpm/10 -> 8000
    64: 90 // idle_rpm/10 -> 900
  })
}

describe('dirt2 adapter', () => {
  it('binds to dirt2 id and port 20778', () => {
    expect(dirt2Adapter.id).toBe('dirt2')
    expect(dirt2Adapter.transport).toEqual({ protocol: 'udp', defaultPort: 20778 })
  })

  it('rejects undersized packets', () => {
    expect(dirt2Adapter.decode(Buffer.alloc(68))).toBeNull()
    expect(dirt2Adapter.decode(Buffer.alloc(263))).toBeNull()
  })

  it('decodes a full frame with Codemasters unit conventions', () => {
    const t = dirt2Adapter.decode(fullPacket())!
    expect(t).not.toBeNull()
    expect(t.isRaceOn).toBe(true)
    expect(t.speedKmh).toBeCloseTo(180, 1) // 50 m/s
    expect(t.rpm).toBeCloseTo(7500, 1) // ×10
    expect(t.rpmMax).toBeCloseTo(8000, 1)
    expect(t.rpmIdle).toBeCloseTo(900, 1)
    expect(t.gear).toBe(4)
    expect(t.throttle).toBeCloseTo(1.0, 5)
    expect(t.brake).toBeCloseTo(0.25, 5)
    expect(t.clutch).toBeCloseTo(0.75, 5)
    expect(t.steer).toBeCloseTo(-0.5, 5)
    expect(t.timestampMs).toBeCloseTo(12500, 1)
    expect(t.rawLength).toBe(264)
  })

  it('maps g-forces to m/s² (x=lateral, z=longitudinal)', () => {
    const t = dirt2Adapter.decode(fullPacket())!
    expect(t.acceleration.x).toBeCloseTo(0.8 * 9.80665, 3)
    expect(t.acceleration.z).toBeCloseTo(-1.2 * 9.80665, 3)
    expect(t.acceleration.y).toBe(0)
  })

  it('reindexes suspension from [RL,RR,FL,FR] to {fl,fr,rl,rr}', () => {
    const t = dirt2Adapter.decode(fullPacket())!
    expect(t.suspensionMeters.rl).toBeCloseTo(0.11, 4)
    expect(t.suspensionMeters.rr).toBeCloseTo(0.12, 4)
    expect(t.suspensionMeters.fl).toBeCloseTo(0.13, 4)
    expect(t.suspensionMeters.fr).toBeCloseTo(0.14, 4)
  })

  it('derives fuel fraction from tank / capacity', () => {
    const t = dirt2Adapter.decode(fullPacket())!
    expect(t.fuel).toBeCloseTo(0.5, 5) // 30 / 60
  })

  it('maps lap channels', () => {
    const t = dirt2Adapter.decode(fullPacket())!
    expect(t.lap.current).toBeCloseTo(42.5, 3)
    expect(t.lap.last).toBeCloseTo(95.3, 3)
    expect(t.lap.distance).toBeCloseTo(1234, 0)
    expect(t.lap.number).toBe(2)
    expect(t.lap.racePosition).toBe(3)
  })

  it('zeroes channels DiRT does not provide', () => {
    const t = dirt2Adapter.decode(fullPacket())!
    expect(t.slipRatio).toEqual({ fl: 0, fr: 0, rl: 0, rr: 0 })
    expect(t.slipAngle).toEqual({ fl: 0, fr: 0, rl: 0, rr: 0 })
    expect(t.tireTempC).toEqual({ fl: 0, fr: 0, rl: 0, rr: 0 })
    expect(t.wheelRotation).toBeNull()
    expect(t.torque).toBeNull()
    expect(t.boost).toBeNull()
  })

  it('derives heading from the forward basis vector', () => {
    // forward = +x → yaw = atan2(1, 0) = π/2
    const t = dirt2Adapter.decode(packet({ 14: 1, 15: 0, 16: 0 }))!
    expect(t.yaw).toBeCloseTo(Math.PI / 2, 4)
  })
})
