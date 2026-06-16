import { describe, expect, it } from 'vitest'
import { wrcAdapter } from '../../server/adapters/wrc'

// Build an EA Sports WRC default `wrc` session_update packet (237 bytes, packed).
function fullPacket(): Buffer {
  const b = Buffer.alloc(237)
  b.writeFloatLE(30.0, 8) // game_total_time -> 30000 ms
  b.writeUInt8(3, 37) // gear_index
  b.writeUInt8(1, 38) // gear_index_neutral
  b.writeUInt8(0, 39) // gear_index_reverse  -> gear = 3 - 1 = 2
  b.writeUInt8(6, 40) // gear_maximum
  b.writeFloatLE(40, 41) // speed m/s -> 144 km/h
  b.writeFloatLE(10, 49); b.writeFloatLE(20, 53); b.writeFloatLE(30, 57) // position
  b.writeFloatLE(40, 61); b.writeFloatLE(0, 65); b.writeFloatLE(0, 69) // velocity
  b.writeFloatLE(0, 73); b.writeFloatLE(0, 77); b.writeFloatLE(5, 81) // accel world (0,0,5)
  b.writeFloatLE(1, 85); b.writeFloatLE(0, 89); b.writeFloatLE(0, 93) // left = +x
  b.writeFloatLE(0, 97); b.writeFloatLE(0, 101); b.writeFloatLE(1, 105) // forward = +z
  b.writeFloatLE(0, 109); b.writeFloatLE(1, 113); b.writeFloatLE(0, 117) // up = +y
  // hub_position BL,BR,FL,FR
  b.writeFloatLE(0.21, 121); b.writeFloatLE(0.22, 125); b.writeFloatLE(0.23, 129); b.writeFloatLE(0.24, 133)
  b.writeFloatLE(8000, 185) // rpm_max
  b.writeFloatLE(900, 189) // rpm_idle
  b.writeFloatLE(6500, 193) // rpm_current
  b.writeFloatLE(1.0, 197) // throttle
  b.writeFloatLE(0.5, 201) // brake
  b.writeFloatLE(0.25, 205) // clutch
  b.writeFloatLE(-0.3, 209) // steering
  b.writeFloatLE(0, 213) // handbrake
  b.writeFloatLE(55.5, 217) // stage_current_time -> lap.current
  b.writeDoubleLE(2500, 221) // stage_current_distance (f64)
  b.writeDoubleLE(6000, 229) // stage_length (f64)
  return b
}

describe('wrc adapter', () => {
  it('binds to wrc id and port 20789', () => {
    expect(wrcAdapter.id).toBe('wrc')
    expect(wrcAdapter.transport).toEqual({ protocol: 'udp', defaultPort: 20789 })
  })

  it('rejects undersized packets', () => {
    expect(wrcAdapter.decode(Buffer.alloc(236))).toBeNull()
  })

  it('decodes a full frame with EA WRC unit conventions', () => {
    const t = wrcAdapter.decode(fullPacket())!
    expect(t).not.toBeNull()
    expect(t.isRaceOn).toBe(true)
    expect(t.speedKmh).toBeCloseTo(144, 1) // 40 m/s
    expect(t.rpm).toBeCloseTo(6500, 1) // true rpm, no scaling
    expect(t.rpmMax).toBeCloseTo(8000, 1)
    expect(t.rpmIdle).toBeCloseTo(900, 1)
    expect(t.gear).toBe(2)
    expect(t.throttle).toBeCloseTo(1.0, 5)
    expect(t.brake).toBeCloseTo(0.5, 5)
    expect(t.clutch).toBeCloseTo(0.25, 5)
    expect(t.steer).toBeCloseTo(-0.3, 5)
    expect(t.timestampMs).toBeCloseTo(30000, 1)
    expect(t.rawLength).toBe(237)
  })

  it('projects world-space acceleration onto the car basis', () => {
    const t = wrcAdapter.decode(fullPacket())!
    // accel (0,0,5) · forward(0,0,1) = 5 longitudinal; lateral/vertical = 0
    expect(t.acceleration.z).toBeCloseTo(5, 4)
    expect(t.acceleration.x).toBeCloseTo(0, 4)
    expect(t.acceleration.y).toBeCloseTo(0, 4)
  })

  it('derives orientation from the basis vectors', () => {
    const t = wrcAdapter.decode(fullPacket())!
    expect(t.yaw).toBeCloseTo(0, 4) // forward = +z
    expect(t.pitch).toBeCloseTo(0, 4)
    expect(t.roll).toBeCloseTo(0, 4)
  })

  it('reindexes hub position from [BL,BR,FL,FR] to {fl,fr,rl,rr}', () => {
    const t = wrcAdapter.decode(fullPacket())!
    expect(t.suspensionMeters.rl).toBeCloseTo(0.21, 4)
    expect(t.suspensionMeters.rr).toBeCloseTo(0.22, 4)
    expect(t.suspensionMeters.fl).toBeCloseTo(0.23, 4)
    expect(t.suspensionMeters.fr).toBeCloseTo(0.24, 4)
  })

  it('maps stage time/distance to lap channels', () => {
    const t = wrcAdapter.decode(fullPacket())!
    expect(t.lap.current).toBeCloseTo(55.5, 3)
    expect(t.lap.distance).toBeCloseTo(2500, 0)
    expect(t.lap.raceTime).toBeCloseTo(30, 3)
  })

  it('disambiguates reverse and neutral via marker indices', () => {
    const b = fullPacket()
    b.writeUInt8(0, 37) // gear_index == reverse_index (0) -> reverse
    expect(wrcAdapter.decode(b)!.gear).toBe(-1)
    b.writeUInt8(1, 37) // gear_index == neutral_index (1) -> neutral
    expect(wrcAdapter.decode(b)!.gear).toBe(0)
  })

  it('nulls channels WRC does not provide', () => {
    const t = wrcAdapter.decode(fullPacket())!
    expect(t.fuel).toBeNull()
    expect(t.torque).toBeNull()
    expect(t.boost).toBeNull()
    expect(t.wheelRotation).toBeNull()
    expect(t.tireTempC).toEqual({ fl: 0, fr: 0, rl: 0, rr: 0 })
  })
})
