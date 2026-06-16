/**
 * OutGauge adapter — the Live for Speed dashboard protocol, also emitted
 * natively by BeamNG.drive. STATELESS: one fixed 92-byte struct (96 with the
 * optional trailing `ID`), little-endian.
 *
 * OutGauge is a *dashboard* feed — speed, rpm, gear, pedals, fuel, boost,
 * lights — with NO motion (position/velocity/acceleration/orientation), NO
 * per-wheel physics and NO lap data. Those channels are zero/null here; for
 * BeamNG, the separate OutSim stream would be needed to fill them.
 *
 * The factory lets BeamNG and LFS share this decoder under their own ids/ports
 * (see ./index.ts), mirroring sms-udp's pcars2/ams2 reuse. Struct offsets are
 * from the LFS InSim OutGaugePack reference; see docs/outgauge-telemetry-mapping.md.
 */

import type { GameId } from '#shared/games'
import type { Quad, Telemetry } from '../utils/decode'
import type { TelemetryAdapter } from './types'

const MIN_BYTES = 92
const BAR_TO_PSI = 14.5037738

const zeroQuad = (): Quad => ({ fl: 0, fr: 0, rl: 0, rr: 0 })
const zeroVec = (): { x: number, y: number, z: number } => ({ x: 0, y: 0, z: 0 })

/** Build an OutGauge adapter bound to a given game id and UDP port. */
export function createOutGaugeAdapter(id: GameId, defaultPort: number): TelemetryAdapter {
  function decode(buf: Buffer): Telemetry | null {
    if (buf.length < MIN_BYTES) return null

    const gearRaw = buf.readUInt8(10) // Reverse:0, Neutral:1, First:2…
    const turboBar = buf.readFloatLE(20)

    return {
      isRaceOn: true, // OutGauge has no pause/state bit; streams only while live
      timestampMs: Date.now(), // Time field is N/A in BeamNG — wall-clock (live-only)

      rpm: buf.readFloatLE(16),
      rpmMax: 0, // no channel
      rpmIdle: 0,

      speedKmh: buf.readFloatLE(12) * 3.6, // m/s
      power: 0,
      torque: null,
      boost: turboBar * BAR_TO_PSI, // BAR → gauge PSI

      gear: gearRaw - 1, // → reverse -1, neutral 0, first 1…
      throttle: buf.readFloatLE(48),
      brake: buf.readFloatLE(52),
      clutch: buf.readFloatLE(56),
      handBrake: 0, // no channel
      steer: 0, // OutGauge carries no steering input
      drivingLine: null,
      aiBrakeDifference: null,

      suspension: zeroQuad(),
      suspensionMeters: zeroQuad(),
      slipRatio: zeroQuad(),
      slipAngle: zeroQuad(),
      combinedSlip: zeroQuad(),
      tireTempC: zeroQuad(),
      wheelRotation: null,
      rumble: null,
      puddle: null,

      yaw: 0, pitch: 0, roll: 0, // no orientation channel
      position: zeroVec(),
      velocity: zeroVec(),
      acceleration: zeroVec(),
      angularVelocity: zeroVec(),

      car: { ordinal: 0, class: 0, pi: 0, drivetrain: 0, cylinders: 0 },

      lap: { number: 0, racePosition: 0, current: 0, last: 0, best: 0, raceTime: 0, distance: 0 },

      fuel: buf.readFloatLE(28), // 0..1
      rawLength: buf.length
    }
  }

  return { id, transport: { protocol: 'udp', defaultPort }, decode }
}

export const beamngAdapter = createOutGaugeAdapter('beamng', 4444)
