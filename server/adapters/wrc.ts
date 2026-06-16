/**
 * EA Sports WRC adapter — Codemasters' configurable "custom UDP" telemetry.
 *
 * WRC's packet layout is defined by JSON files the game ships in
 * `…/Documents/My Games/WRC/telemetry/udp/`. This adapter targets the shipped
 * read-only default **`wrc.json`** `session_update` packet, so the user only has
 * to point that structure at our port. Like Forza/DiRT it is STATELESS: one
 * self-contained 237-byte packet (packed, no alignment, little-endian) carries a
 * full frame. There is no header — the stream starts at `packet_uid`.
 *
 * Enable in the game's telemetry config (structure = `wrc`, ip 127.0.0.1,
 * port 20789). Offsets are computed from `readme/udp/wrc.json` (channel order)
 * and `readme/channels.json` (channel types); see docs/wrc-telemetry-mapping.md
 * for the full table and the open verification items (orientation signs).
 *
 * Wheel arrays are ordered [BL, BR, FL, FR]; our `Quad` is {fl,fr,rl,rr}.
 */

import type { Quad, Telemetry } from '../utils/decode'
import type { TelemetryAdapter } from './types'

const PACKET_BYTES = 237

const zeroQuad = (): Quad => ({ fl: 0, fr: 0, rl: 0, rr: 0 })
const clamp1 = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v)

function decode(buf: Buffer): Telemetry | null {
  if (buf.length < PACKET_BYTES) return null

  const f = (off: number): number => buf.readFloatLE(off)
  // hub_position [BL,BR,FL,FR] at (base, +4, +8, +12) → our {fl,fr,rl,rr}.
  const quad = (base: number): Quad => ({
    fl: f(base + 8),
    fr: f(base + 12),
    rl: f(base + 0),
    rr: f(base + 4)
  })

  // Gear: indices, disambiguated by the neutral/reverse marker channels.
  const gearIdx = buf.readUInt8(37)
  const neutralIdx = buf.readUInt8(38)
  const reverseIdx = buf.readUInt8(39)
  const gear = gearIdx === reverseIdx ? -1 : gearIdx - neutralIdx

  // World-space acceleration projected onto the car basis → car-local g-g.
  const a = { x: f(73), y: f(77), z: f(81) }
  const left = { x: f(85), y: f(89), z: f(93) }
  const fwd = { x: f(97), y: f(101), z: f(105) }
  const up = { x: f(109), y: f(113), z: f(117) }
  const dot = (u: typeof a, v: typeof a): number => u.x * v.x + u.y * v.y + u.z * v.z

  return {
    isRaceOn: true, // default packet has no pause scope; streams only while live
    timestampMs: f(8) * 1000, // game_total_time (s)

    rpm: f(193), // true rpm, no scaling
    rpmMax: f(185),
    rpmIdle: f(189),

    speedKmh: f(41) * 3.6, // m/s
    power: 0, // no channel
    torque: null,
    boost: null,

    gear,
    throttle: f(197),
    brake: f(201),
    clutch: f(205),
    handBrake: f(213),
    steer: f(209),
    drivingLine: null,
    aiBrakeDifference: null,

    suspension: zeroQuad(), // no normalized-travel channel
    suspensionMeters: quad(121), // hub position (m)
    slipRatio: zeroQuad(), // no slip channels (only contact-patch fwd speed @153)
    slipAngle: zeroQuad(),
    combinedSlip: zeroQuad(),
    tireTempC: zeroQuad(), // only brake temps exist (@169), not tyre temps
    wheelRotation: null, // contact-patch speed is linear m/s, not angular
    rumble: null,
    puddle: null,

    yaw: Math.atan2(fwd.x, fwd.z),
    pitch: Math.asin(clamp1(fwd.y)),
    roll: Math.atan2(left.y, up.y),

    position: { x: f(49), y: f(53), z: f(57) },
    velocity: { x: f(61), y: f(65), z: f(69) },
    // x=lateral (·left), y=vertical (·up), z=longitudinal (·forward).
    acceleration: { x: dot(a, left), y: dot(a, up), z: dot(a, fwd) },
    angularVelocity: { x: 0, y: 0, z: 0 }, // no channel

    car: { ordinal: 0, class: 0, pi: 0, drivetrain: 0, cylinders: 0 },

    lap: {
      number: 0, // stage-based: no lap number in default packet
      racePosition: 0,
      current: f(217), // stage_current_time (s)
      last: 0,
      best: 0,
      raceTime: f(8),
      distance: buf.readDoubleLE(221) // stage_current_distance (m)
    },

    fuel: null, // no fuel channel in default packet
    rawLength: buf.length
  }
}

export const wrcAdapter: TelemetryAdapter = {
  id: 'wrc',
  transport: { protocol: 'udp', defaultPort: 20789 },
  decode
}
