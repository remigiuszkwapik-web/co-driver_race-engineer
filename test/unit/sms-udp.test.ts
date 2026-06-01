import { describe, expect, it } from 'vitest'
import { createSmsUdpAdapter, smsUdpAdapter } from '../../server/adapters/sms-udp'

const IDX = 1 // viewed participant index

function header(buf: Buffer, type: number): Buffer {
  buf.writeUInt8(type, 10) // PacketBase.mPacketType
  return buf
}

function telemetryPacket(): Buffer {
  const buf = header(Buffer.alloc(556), 0)
  buf.writeInt8(IDX, 12) // sViewedParticipantIndex
  buf.writeUInt8(229, 29) // brake (0.898)
  buf.writeUInt8(255, 30) // throttle (1.0)
  buf.writeUInt8(0, 31) // clutch
  buf.writeFloatLE(0.6, 32) // fuel
  buf.writeFloatLE(50, 36) // speed m/s -> 180 km/h
  buf.writeUInt16LE(9500, 40) // rpm
  buf.writeUInt16LE(12000, 42) // maxRpm
  buf.writeInt8(64, 44) // steering
  buf.writeUInt8(0x64, 45) // gearNumGears: gear 4, 6 gears
  buf.writeFloatLE(0.1, 52) // orientation[0] yaw
  buf.writeFloatLE(-0.02, 56) // pitch
  buf.writeFloatLE(0.03, 60) // roll
  buf.writeFloatLE(60, 76) // worldVelocity x
  buf.writeFloatLE(0, 80)
  buf.writeFloatLE(1, 84)
  buf.writeFloatLE(2.5, 88) // angularVelocity x
  buf.writeFloatLE(0, 92)
  buf.writeFloatLE(0, 96)
  buf.writeFloatLE(9.8, 100) // localAcceleration x
  buf.writeFloatLE(0, 104)
  buf.writeFloatLE(0, 108)
  // tyre rps [FL,FR,RL,RR] @160
  buf.writeFloatLE(10, 160)
  buf.writeFloatLE(11, 164)
  buf.writeFloatLE(12, 168)
  buf.writeFloatLE(13, 172)
  // tyre temp u8 @176 [FL,FR,RL,RR]
  buf.writeUInt8(80, 176)
  buf.writeUInt8(81, 177)
  buf.writeUInt8(82, 178)
  buf.writeUInt8(83, 179)
  // suspension travel f32 @312
  buf.writeFloatLE(0.01, 312)
  buf.writeFloatLE(0.02, 316)
  buf.writeFloatLE(0.03, 320)
  buf.writeFloatLE(0.04, 324)
  buf.writeFloatLE(600, 360) // engineSpeed (rad/s)
  buf.writeFloatLE(400, 364) // engineTorque -> power 240000
  buf.writeUInt8(128, 370) // handBrake
  buf.writeFloatLE(1.5, 538) // turbo boost
  buf.writeFloatLE(100, 542) // fullPosition x
  buf.writeFloatLE(5, 546)
  buf.writeFloatLE(-250, 550)
  return buf
}

function timingsPacket(): Buffer {
  const buf = header(Buffer.alloc(1059), 3)
  const base = 33 + IDX * 32
  buf.writeUInt16LE(1234, base + 12) // currentLapDistance
  buf.writeUInt8(0x80 | 3, base + 14) // racePosition 3 (+ active top bit)
  buf.writeUInt8(5, base + 21) // currentLap
  buf.writeFloatLE(42.5, base + 22) // currentTime
  return buf
}

function timeStatsPacket(): Buffer {
  const buf = header(Buffer.alloc(1040), 7)
  const base = 16 + IDX * 32
  buf.writeFloatLE(85.1, base + 0) // fastestLapTime
  buf.writeFloatLE(86.4, base + 4) // lastLapTime
  return buf
}

function gameStatePacket(playing: boolean): Buffer {
  const buf = header(Buffer.alloc(24), 4)
  buf.writeUInt8(playing ? 2 : 1, 14) // mGameState: 2 = playing
  return buf
}

describe('sms-udp adapter', () => {
  it('binds to pcars2 id and the SMS UDP port', () => {
    expect(smsUdpAdapter.id).toBe('pcars2')
    expect(smsUdpAdapter.transport).toEqual({ protocol: 'udp', defaultPort: 5606 })
  })

  it('emits only on the Car Physics packet; folds the others into state', () => {
    const a = createSmsUdpAdapter()
    expect(a.decode(gameStatePacket(true))).toBeNull()
    expect(a.decode(timingsPacket())).toBeNull()
    expect(a.decode(timeStatsPacket())).toBeNull()
    expect(a.decode(telemetryPacket())).not.toBeNull()
  })

  it('rejects undersized / unknown packets', () => {
    const a = createSmsUdpAdapter()
    expect(a.decode(Buffer.alloc(8))).toBeNull()
    expect(a.decode(header(Buffer.alloc(100), 0))).toBeNull() // too short for telemetry
    expect(a.decode(header(Buffer.alloc(50), 99))).toBeNull() // unknown type
  })

  it('decodes physics with SMS unit conventions', () => {
    const a = createSmsUdpAdapter()
    const t = a.decode(telemetryPacket())!
    expect(t.speedKmh).toBeCloseTo(180, 1) // 50 m/s
    expect(t.rpm).toBe(9500)
    expect(t.rpmMax).toBe(12000)
    expect(t.throttle).toBe(1)
    expect(t.brake).toBeCloseTo(229 / 255, 4)
    expect(t.steer).toBeCloseTo(64 / 127, 4)
    expect(t.gear).toBe(4)
    expect(t.handBrake).toBeCloseTo(128 / 255, 4)
    expect(t.fuel).toBeCloseTo(0.6, 5)
    expect(t.tireTempC).toEqual({ fl: 80, fr: 81, rl: 82, rr: 83 }) // [FL,FR,RL,RR], no reindex
    expect(t.position).toEqual({ x: 100, y: 5, z: -250 })
    expect(t.rawLength).toBe(556)
  })

  it('derives power as torque × engine speed', () => {
    const a = createSmsUdpAdapter()
    const t = a.decode(telemetryPacket())!
    expect(t.torque).toBeCloseTo(400, 1)
    expect(t.power).toBeCloseTo(240000, 0) // 400 Nm × 600 rad/s
  })

  it('converts tyre rev/s to rad/s for wheel rotation', () => {
    const a = createSmsUdpAdapter()
    const t = a.decode(telemetryPacket())!
    expect(t.wheelRotation!.fl).toBeCloseTo(10 * Math.PI * 2, 3)
    expect(t.wheelRotation!.rr).toBeCloseTo(13 * Math.PI * 2, 3)
  })

  it('has no slip channels (zeroed)', () => {
    const a = createSmsUdpAdapter()
    const t = a.decode(telemetryPacket())!
    expect(t.slipRatio).toEqual({ fl: 0, fr: 0, rl: 0, rr: 0 })
    expect(t.slipAngle).toEqual({ fl: 0, fr: 0, rl: 0, rr: 0 })
  })

  it('merges lap data from Timings + TimeStats for the viewed participant', () => {
    const a = createSmsUdpAdapter()
    a.decode(timingsPacket())
    a.decode(timeStatsPacket())
    const t = a.decode(telemetryPacket())!
    expect(t.lap.number).toBe(5)
    expect(t.lap.racePosition).toBe(3) // active top bit masked off
    expect(t.lap.current).toBeCloseTo(42.5, 3)
    expect(t.lap.best).toBeCloseTo(85.1, 3)
    expect(t.lap.last).toBeCloseTo(86.4, 3)
    expect(t.lap.distance).toBeCloseTo(1234, 0)
  })

  it('derives isRaceOn from game state', () => {
    const a = createSmsUdpAdapter()
    a.decode(gameStatePacket(false))
    expect(a.decode(telemetryPacket())!.isRaceOn).toBe(false)
    a.decode(gameStatePacket(true))
    expect(a.decode(telemetryPacket())!.isRaceOn).toBe(true)
  })

  it('keeps gear -1 for reverse (nibble 15)', () => {
    const a = createSmsUdpAdapter()
    const p = telemetryPacket()
    p.writeUInt8(0x6f, 45) // gear nibble = 15 (reverse), 6 gears
    expect(a.decode(p)!.gear).toBe(-1)
  })
})
