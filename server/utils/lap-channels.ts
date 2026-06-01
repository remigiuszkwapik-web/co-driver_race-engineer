/**
 * Flat, tabular view of a lap's telemetry — the single source of truth for the
 * tabular export formats (generic CSV and MoTeC i2 CSV). Each channel is one
 * column; quads expand to four columns (fl/fr/rl/rr) and vec3s to three
 * (x/y/z), because spreadsheet/analysis tools want a flat grid, not nested
 * objects. The native co-driver bundle and the raw-JSON export do NOT use this
 * — they carry the full nested `Telemetry` verbatim.
 *
 * Unit note: the canonical `Telemetry` model stores pedals as 0..1 and steer as
 * -1..1 (see server/adapters/*). Pedals are scaled to 0..100 % here because
 * that's what analyst traces expect; consumers who want the raw fractions can
 * use the Raw JSON export, where frames are untouched. Nullable channels
 * (boost/torque/fuel/drivingLine) return `null`; the row writer renders that as
 * an empty field.
 */
import type { Telemetry } from './decode'

export interface LapChannel {
  name: string
  unit: string
  /** Value for this frame, or null when the channel is absent on this feed. */
  get: (f: Telemetry, t0: number) => number | null
}

const pct = (v: number): number => v * 100

export const LAP_CHANNELS: LapChannel[] = [
  { name: 'Time', unit: 's', get: (f, t0) => (f.timestampMs - t0) / 1000 },
  { name: 'Speed', unit: 'km/h', get: f => f.speedKmh },
  { name: 'RPM', unit: 'rpm', get: f => f.rpm },
  { name: 'Gear', unit: '', get: f => f.gear },
  { name: 'Throttle', unit: '%', get: f => pct(f.throttle) },
  { name: 'Brake', unit: '%', get: f => pct(f.brake) },
  { name: 'Clutch', unit: '%', get: f => pct(f.clutch) },
  { name: 'Handbrake', unit: '%', get: f => pct(f.handBrake) },
  { name: 'Steer', unit: '', get: f => f.steer },
  { name: 'Boost', unit: 'psi', get: f => f.boost },
  { name: 'Power', unit: 'kW', get: f => f.power },
  { name: 'Torque', unit: 'Nm', get: f => f.torque },
  { name: 'Fuel', unit: '', get: f => f.fuel },
  { name: 'Yaw', unit: 'rad', get: f => f.yaw },
  { name: 'Pitch', unit: 'rad', get: f => f.pitch },
  { name: 'Roll', unit: 'rad', get: f => f.roll },
  { name: 'LapDistance', unit: 'm', get: f => f.lap.distance },
  { name: 'DrivingLine', unit: '', get: f => f.drivingLine },

  // quads → fl/fr/rl/rr
  ...quad('Susp', 'm', f => f.suspensionMeters),
  ...quad('SlipRatio', '', f => f.slipRatio),
  ...quad('SlipAngle', '', f => f.slipAngle),
  ...quad('CombinedSlip', '', f => f.combinedSlip),
  ...quad('TireTemp', '°C', f => f.tireTempC),

  // vec3 → x/y/z
  ...vec3('Pos', 'm', f => f.position),
  ...vec3('Vel', 'm/s', f => f.velocity),
  ...vec3('Accel', 'm/s²', f => f.acceleration),
  ...vec3('AngVel', 'rad/s', f => f.angularVelocity)
]

function quad(
  prefix: string,
  unit: string,
  pick: (f: Telemetry) => { fl: number, fr: number, rl: number, rr: number }
): LapChannel[] {
  return (['fl', 'fr', 'rl', 'rr'] as const).map(corner => ({
    name: `${prefix} ${corner.toUpperCase()}`,
    unit,
    get: (f: Telemetry) => pick(f)[corner]
  }))
}

function vec3(
  prefix: string,
  unit: string,
  pick: (f: Telemetry) => { x: number, y: number, z: number }
): LapChannel[] {
  return (['x', 'y', 'z'] as const).map(axis => ({
    name: `${prefix} ${axis.toUpperCase()}`,
    unit,
    get: (f: Telemetry) => pick(f)[axis]
  }))
}
