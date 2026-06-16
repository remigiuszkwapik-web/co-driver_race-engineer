import { describe, expect, it } from 'vitest'
import { gt7Adapter } from '../../server/adapters/gt7'
import { salsa20 } from '../../server/adapters/salsa20'

const KEY = Buffer.from('Simulator Interface Packet GT7 ver 0.0', 'ascii').subarray(0, 32)
const SEED = 0x12345678

// Build a valid encrypted GT7 "A" packet from a plaintext built by `set`.
// The IV seed lives in the ciphertext at 0x40; decode reads it, derives the
// nonce, and decrypts. We compute the keystream for that seed, XOR our
// plaintext, then stamp the seed at 0x40.
function encrypted(set: (p: Buffer) => void): Buffer {
  const iv2 = (SEED ^ 0xDEADBEAF) >>> 0
  const nonce = Buffer.alloc(8)
  nonce.writeUInt32LE(iv2, 0)
  nonce.writeUInt32LE(SEED, 4)
  const ks = salsa20(KEY, nonce, Buffer.alloc(296)) // raw keystream

  const plain = Buffer.alloc(296)
  plain.writeUInt32LE(0x47375330, 0) // magic
  set(plain)

  const ct = Buffer.alloc(296)
  for (let i = 0; i < 296; i++) ct[i] = plain[i]! ^ ks[i]!
  ct.writeUInt32LE(SEED, 0x40) // seed read by the decoder (overwrites that field)
  return ct
}

function fullPacket(): Buffer {
  return encrypted((p) => {
    // position
    p.writeFloatLE(100, 0x04)
    p.writeFloatLE(5, 0x08)
    p.writeFloatLE(-250, 0x0c)
    p.writeFloatLE(50, 0x10) // velocity x
    p.writeFloatLE(7000, 0x3c) // rpm
    p.writeFloatLE(30, 0x44) // fuel level
    p.writeFloatLE(60, 0x48) // fuel capacity
    p.writeFloatLE(50, 0x4c) // speed m/s -> 180 km/h
    p.writeFloatLE(2.0, 0x50) // boost ratio -> (2-1) bar
    // tyre temp FL/FR/RL/RR
    p.writeFloatLE(80, 0x60)
    p.writeFloatLE(81, 0x64)
    p.writeFloatLE(82, 0x68)
    p.writeFloatLE(83, 0x6c)
    p.writeInt16LE(2, 0x74) // current lap
    p.writeInt32LE(90000, 0x78) // best lap ms
    p.writeInt32LE(95000, 0x7c) // last lap ms
    p.writeInt32LE(30000, 0x80) // time on track ms
    p.writeInt16LE(3, 0x84) // race position
    p.writeUInt16LE(8000, 0x8a) // rev limiter -> rpmMax
    p.writeUInt8(0x01, 0x8e) // flags: on-track, not paused
    p.writeUInt8(0x34, 0x90) // gear: low nibble 4
    p.writeUInt8(255, 0x91) // throttle
    p.writeUInt8(128, 0x92) // brake
    // wheel angular speed FL/FR/RL/RR (rad/s)
    p.writeFloatLE(10, 0xa4)
    p.writeFloatLE(11, 0xa8)
    p.writeFloatLE(12, 0xac)
    p.writeFloatLE(13, 0xb0)
    // suspension height FL/FR/RL/RR
    p.writeFloatLE(0.11, 0xc4)
    p.writeFloatLE(0.12, 0xc8)
    p.writeFloatLE(0.13, 0xcc)
    p.writeFloatLE(0.14, 0xd0)
    p.writeFloatLE(1.0, 0xf4) // clutch
    p.writeInt32LE(1234, 0x124) // car id
  })
}

describe('gt7 adapter', () => {
  it('binds to gt7, port 33740, with an A heartbeat to 33739', () => {
    expect(gt7Adapter.id).toBe('gt7')
    expect(gt7Adapter.transport).toEqual({ protocol: 'udp', defaultPort: 33740 })
    expect(gt7Adapter.heartbeat?.port).toBe(33739)
    expect(gt7Adapter.heartbeat?.payload.toString()).toBe('A')
  })

  it('rejects undersized packets and bad magic', () => {
    expect(gt7Adapter.decode(Buffer.alloc(200))).toBeNull()
    expect(gt7Adapter.decode(Buffer.alloc(296))).toBeNull() // decrypts to non-magic
  })

  it('decrypts and decodes a full frame', () => {
    const t = gt7Adapter.decode(fullPacket())!
    expect(t).not.toBeNull()
    expect(t.isRaceOn).toBe(true)
    expect(t.speedKmh).toBeCloseTo(180, 1)
    expect(t.rpm).toBeCloseTo(7000, 1)
    expect(t.rpmMax).toBe(8000)
    expect(t.gear).toBe(4)
    expect(t.throttle).toBeCloseTo(1, 5)
    expect(t.brake).toBeCloseTo(128 / 255, 4)
    expect(t.clutch).toBeCloseTo(1, 5)
    expect(t.timestampMs).toBe(30000)
    expect(t.rawLength).toBe(296)
  })

  it('converts boost ratio to gauge PSI', () => {
    const t = gt7Adapter.decode(fullPacket())!
    expect(t.boost).toBeCloseTo(14.5037738, 4) // (2.0 - 1) bar
  })

  it('maps native per-wheel channels (FL,FR,RL,RR order)', () => {
    const t = gt7Adapter.decode(fullPacket())!
    expect(t.tireTempC).toEqual({ fl: 80, fr: 81, rl: 82, rr: 83 })
    expect(t.wheelRotation).toEqual({ fl: 10, fr: 11, rl: 12, rr: 13 })
    expect(t.suspensionMeters.fl).toBeCloseTo(0.11, 4)
    expect(t.suspensionMeters.rr).toBeCloseTo(0.14, 4)
  })

  it('maps lap, car id and fuel', () => {
    const t = gt7Adapter.decode(fullPacket())!
    expect(t.lap.number).toBe(2)
    expect(t.lap.racePosition).toBe(3)
    expect(t.lap.best).toBeCloseTo(90, 3)
    expect(t.lap.last).toBeCloseTo(95, 3)
    expect(t.lap.raceTime).toBeCloseTo(30, 3)
    expect(t.car.ordinal).toBe(1234)
    expect(t.fuel).toBeCloseTo(0.5, 5)
  })

  it('derives isRaceOn and handBrake from the flags byte', () => {
    const paused = gt7Adapter.decode(encrypted(p => p.writeUInt8(0x03, 0x8e)))! // on-track + paused
    expect(paused.isRaceOn).toBe(false)
    const hb = gt7Adapter.decode(encrypted(p => p.writeUInt8(0x41, 0x8e)))! // on-track + handbrake
    expect(hb.isRaceOn).toBe(true)
    expect(hb.handBrake).toBe(1)
  })

  it('nulls channels GT7 does not send', () => {
    const t = gt7Adapter.decode(fullPacket())!
    expect(t.steer).toBe(0)
    expect(t.acceleration).toEqual({ x: 0, y: 0, z: 0 })
    expect(t.torque).toBeNull()
    expect(t.lap.current).toBe(0)
  })

  it('reverse gear when the low nibble is 0', () => {
    const t = gt7Adapter.decode(encrypted((p) => {
      p.writeUInt8(0x01, 0x8e)
      p.writeUInt8(0x00, 0x90) // nibble 0 -> reverse
    }))!
    expect(t.gear).toBe(-1)
  })
})
