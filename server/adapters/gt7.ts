/**
 * Gran Turismo 7 / GT Sport adapter — Polyphony's encrypted UDP telemetry.
 *
 * The PS4/PS5 broadcasts directly (no PC agent), but with two twists:
 *  1. Packets are Salsa20-encrypted (see ./salsa20.ts).
 *  2. The console only streams after the receiver sends a heartbeat byte `'A'`
 *     to it on port 33739, re-sent periodically. That outbound keep-alive is
 *     declared via the adapter `heartbeat` field and driven by the listener;
 *     the console IP must be supplied in `GT7_HOST` (we can't discover it — we
 *     have to send first).
 *
 * STATELESS once decrypted: the "A" packet (296 bytes) carries a full frame,
 * little-endian. Offsets/crypto are from Nenkai/PDTools and Bornhall/gt7telemetry;
 * see docs/gt7-telemetry-mapping.md. Wheel order is [FL, FR, RL, RR] — our Quad
 * order, so no reindex.
 */

import type { Quad, Telemetry } from '../utils/decode'
import type { TelemetryAdapter } from './types'
import { salsa20 } from './salsa20'

const KEY = Buffer.from('Simulator Interface Packet GT7 ver 0.0', 'ascii').subarray(0, 32)
const MAGIC = 0x47375330 // u32le(@0) of a valid decrypted packet
const PACKET_BYTES = 296 // 0x128 ("A" packet)
const BAR_TO_PSI = 14.5037738

const RECEIVE_PORT = 33740
const HEARTBEAT_PORT = 33739

const zeroQuad = (): Quad => ({ fl: 0, fr: 0, rl: 0, rr: 0 })

/** Decrypt a GT7 datagram, or null if it's the wrong size / fails the magic. */
function decrypt(buf: Buffer): Buffer | null {
  if (buf.length < PACKET_BYTES) return null
  const iv1 = buf.readUInt32LE(0x40)
  const iv2 = (iv1 ^ 0xDEADBEAF) >>> 0
  const nonce = Buffer.alloc(8)
  nonce.writeUInt32LE(iv2, 0)
  nonce.writeUInt32LE(iv1, 4)
  const d = salsa20(KEY, nonce, buf)
  return d.readUInt32LE(0) === MAGIC ? d : null
}

function decode(buf: Buffer): Telemetry | null {
  const d = decrypt(buf)
  if (!d) return null

  const f = (off: number): number => d.readFloatLE(off)
  const quad = (base: number): Quad => ({ fl: f(base), fr: f(base + 4), rl: f(base + 8), rr: f(base + 12) })

  const flags = d.readUInt8(0x8e)
  const cgear = d.readUInt8(0x90) & 0x0f
  const fuelLevel = f(0x44)
  const fuelCap = f(0x48)
  const lapMs = (off: number): number => {
    const v = d.readInt32LE(off)
    return v > 0 ? v / 1000 : 0 // -1 = not set
  }

  return {
    isRaceOn: (flags & 0x01) !== 0 && (flags & 0x02) === 0, // on-track & not paused
    timestampMs: d.readInt32LE(0x80), // time on track (ms)

    rpm: f(0x3c),
    rpmMax: d.readUInt16LE(0x8a), // rev limiter
    rpmIdle: 0, // no channel

    speedKmh: f(0x4c) * 3.6,
    power: 0,
    torque: null,
    boost: (f(0x50) - 1) * BAR_TO_PSI, // raw is absolute ratio; gauge bar = val−1

    gear: cgear < 1 ? -1 : cgear, // low nibble; 0 = reverse
    throttle: d.readUInt8(0x91) / 255,
    brake: d.readUInt8(0x92) / 255,
    clutch: f(0xf4),
    handBrake: (flags & 0x40) !== 0 ? 1 : 0,
    steer: 0, // GT7 carries no steering input
    drivingLine: null,
    aiBrakeDifference: null,

    suspension: zeroQuad(), // no normalized-travel channel
    suspensionMeters: quad(0xc4),
    slipRatio: zeroQuad(), // no slip channels (derivable from wheel speed vs car speed)
    slipAngle: zeroQuad(),
    combinedSlip: zeroQuad(),
    tireTempC: quad(0x60),
    wheelRotation: quad(0xa4), // angular speed (rad/s) — native
    rumble: null,
    puddle: null,

    yaw: f(0x20),
    pitch: f(0x1c),
    roll: f(0x24),

    position: { x: f(0x04), y: f(0x08), z: f(0x0c) },
    velocity: { x: f(0x10), y: f(0x14), z: f(0x18) },
    acceleration: { x: 0, y: 0, z: 0 }, // GT7 sends velocity only, no acceleration
    angularVelocity: { x: f(0x2c), y: f(0x30), z: f(0x34) },

    car: { ordinal: d.readInt32LE(0x124), class: 0, pi: 0, drivetrain: 0, cylinders: 0 },

    lap: {
      number: d.readInt16LE(0x74),
      racePosition: d.readInt16LE(0x84),
      current: 0, // no current-lap-time field in the packet
      last: lapMs(0x7c),
      best: lapMs(0x78),
      raceTime: d.readInt32LE(0x80) / 1000,
      distance: 0 // no lap-distance field
    },

    fuel: fuelCap > 0 ? Math.min(1, Math.max(0, fuelLevel / fuelCap)) : null, // null = EV
    rawLength: buf.length
  }
}

export const gt7Adapter: TelemetryAdapter = {
  id: 'gt7',
  transport: { protocol: 'udp', defaultPort: RECEIVE_PORT },
  decode,
  heartbeat: {
    host: process.env.GT7_HOST, // console IP — required to start the stream
    port: HEARTBEAT_PORT,
    intervalMs: 1000,
    payload: Buffer.from('A', 'ascii')
  }
}
