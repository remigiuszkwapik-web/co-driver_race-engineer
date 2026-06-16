/**
 * DiRT Rally 2.0 adapter — Codemasters "extradata" UDP telemetry.
 *
 * Unlike F1/SMS, this feed is STATELESS: one self-contained 264-byte datagram
 * carries a full frame (like Forza's Data Out). The packet is a flat array of
 * 66 little-endian float32s; byte offset = field index × 4. Enable it in
 * `…/My Games/DiRT Rally 2.0/hardwaresettings/hardware_settings_config.xml`:
 *   <udp enabled="true" extradata="3" ip="127.0.0.1" port="20778" delay="1" />
 *
 * The same wire format covers DiRT Rally 1 and DiRT 4. Offsets are from
 * ErlerPhilipp/dr2_logger (source/dirt_rally/udp_data.py); see
 * docs/dirt-rally2-telemetry-mapping.md for the full field-by-field diff and
 * the open verification items (orientation signs, reverse-gear encoding).
 *
 * Wheel arrays are ordered [RL, RR, FL, FR]; our `Quad` is {fl,fr,rl,rr}, so
 * every per-wheel read reindexes (see `quad`).
 */

import type { Quad, Telemetry } from '../utils/decode'
import type { TelemetryAdapter } from './types'

const G = 9.80665 // g-force → m/s²
const PACKET_BYTES = 264 // extradata=3: 66 float32s

const zeroQuad = (): Quad => ({ fl: 0, fr: 0, rl: 0, rr: 0 })

function decode(buf: Buffer): Telemetry | null {
  if (buf.length < PACKET_BYTES) return null

  const f = (off: number): number => buf.readFloatLE(off)
  // DiRT wheel order [RL, RR, FL, FR] at (base, +4, +8, +12) → our {fl,fr,rl,rr}.
  const quad = (base: number): Quad => ({
    fl: f(base + 8),
    fr: f(base + 12),
    rl: f(base + 0),
    rr: f(base + 4)
  })

  const runTime = f(0)
  const speedMs = f(28)
  const fuelInTank = f(180)
  const fuelCapacity = f(184)

  // Orientation basis vectors: "roll" = car's right axis, "pitch" = forward axis.
  // Euler angles derived from them (unit vectors); signs unverified — see doc.
  const rightY = f(48)
  const fwd = { x: f(56), y: f(60), z: f(64) }
  const clamp = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v)

  return {
    // DiRT exposes no pause flag; it only streams during a live stage.
    isRaceOn: true,
    timestampMs: runTime * 1000,

    rpm: f(148) * 10, // packet stores rpm/10
    rpmMax: f(252) * 10,
    rpmIdle: f(256) * 10,

    speedKmh: speedMs * 3.6,
    power: 0, // no engine-power channel
    torque: null,
    boost: null,

    gear: Math.round(f(132)), // neutral = 0; reverse encoding unverified
    throttle: f(116),
    brake: f(124),
    clutch: f(128),
    handBrake: 0, // no channel
    steer: f(120),
    drivingLine: null,
    aiBrakeDifference: null,

    suspension: zeroQuad(), // no normalized-travel channel
    suspensionMeters: quad(68),
    slipRatio: zeroQuad(), // no slip channels (only linear wheel speed @100)
    slipAngle: zeroQuad(),
    combinedSlip: zeroQuad(),
    tireTempC: zeroQuad(), // only brake temps exist (@204), not tyre temps
    wheelRotation: null, // DiRT gives linear wheel speed (m/s), not angular
    rumble: null,
    puddle: null,

    yaw: Math.atan2(fwd.x, fwd.z),
    pitch: Math.asin(clamp(fwd.y)),
    roll: Math.asin(clamp(rightY)),

    position: { x: f(16), y: f(20), z: f(24) },
    velocity: { x: f(32), y: f(36), z: f(40) },
    // Only lateral/longitudinal g-forces; x=lateral, z=longitudinal, y=0.
    acceleration: { x: f(136) * G, y: 0, z: f(140) * G },
    angularVelocity: { x: 0, y: 0, z: 0 }, // no channel

    // DiRT has no Performance Index / ordinal; max gears is the only car datum.
    car: { ordinal: 0, class: 0, pi: 0, drivetrain: 0, cylinders: 0 },

    lap: {
      number: Math.round(f(144)), // starts at 0
      racePosition: Math.round(f(156)),
      current: f(4),
      last: f(248),
      best: 0, // no best-lap channel (rally is single-stage)
      raceTime: runTime,
      distance: Math.max(0, f(8)) // current-lap metres
    },

    fuel: fuelCapacity > 0 ? Math.min(1, Math.max(0, fuelInTank / fuelCapacity)) : null,
    rawLength: buf.length
  }
}

export const dirt2Adapter: TelemetryAdapter = {
  id: 'dirt2',
  transport: { protocol: 'udp', defaultPort: 20778 },
  decode
}
