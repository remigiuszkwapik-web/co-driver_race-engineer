/**
 * Tune field metadata — the slider-side configuration that lives on top of
 * a Build. Mirrors `/tune/*` reference page structure. Phase 1b ships this
 * alongside `app/utils/build-fields.ts`.
 *
 * Stored in Forza's native units (lb/in for springs, psi for tire pressure,
 * inches for ride height, lb for downforce, degrees for alignment). Fields
 * carrying `unitCategory` have their displayed unit driven by useUnits
 * prefs — storage stays canonical. Drivetrain-gated fields (differential)
 * are filtered by the parent build's drivetrain at render time.
 */

import type { SetupField } from './build-fields'

/** Drivetrain visibility for a tune field — limits which builds show it. */
export type DrivetrainGate = 'fwd' | 'rwd' | 'awd' | Array<'fwd' | 'rwd' | 'awd'>

export interface TuneField extends SetupField {
  /** If set, only render this field when the parent build's drivetrain matches. */
  requiresDrivetrain?: DrivetrainGate
  /** FH6-wide minimum, in the field's canonical/storage unit. Omitted for
   *  per-car-varying fields (springs, ride height, aero F/R). */
  min?: number
  /** FH6-wide maximum, in canonical storage unit. */
  max?: number
  /** Slider step in canonical storage unit. For unit-category fields the form
   *  converts this via the active unit pref before applying to the input. */
  step?: number
}

const ALL_DRIVETRAINS = ['fwd', 'rwd', 'awd'] as const

function isVisible(gate: DrivetrainGate | undefined, drivetrain: string | null | undefined): boolean {
  if (!gate) return true
  const allowed = Array.isArray(gate) ? gate : [gate]
  if (!drivetrain) return false // unknown drivetrain → hide gated fields
  return (allowed as readonly string[]).includes(drivetrain)
}

export function visibleTuneFields(drivetrain: string | null | undefined): TuneField[] {
  return TUNE_FIELDS.filter(f => isVisible(f.requiresDrivetrain, drivetrain))
}

/** Logical section ordering for the form layout. */
export const TUNE_SECTIONS = [
  'springs',
  'dampers',
  'arb',
  'rideHeight',
  'alignment',
  'tirePressure',
  'differential',
  'brakes',
  'aero',
  'gears',
  'notes'
] as const

/** Sections expanded by default in TuneForm — the most-edited ones. */
export const DEFAULT_OPEN_SECTIONS: Readonly<Record<typeof TUNE_SECTIONS[number], boolean>> = {
  springs: true,
  dampers: true,
  arb: true,
  rideHeight: false,
  alignment: false,
  tirePressure: false,
  differential: false,
  brakes: true,
  aero: false,
  gears: false,
  notes: false
}

export const SECTION_LABELS: Record<typeof TUNE_SECTIONS[number], string> = {
  springs: 'Springs',
  dampers: 'Dampers',
  arb: 'Anti-roll bars',
  rideHeight: 'Ride height',
  alignment: 'Alignment',
  tirePressure: 'Tire pressure',
  differential: 'Differential',
  brakes: 'Brakes',
  aero: 'Aero',
  gears: 'Gearing',
  notes: 'Notes'
}

// Tire-pressure bounds were captured in FH6 as 1.0–3.8 bar with 0.1-bar steps.
// Converted to canonical psi (1 psi = 0.0689476 bar): the bar 0.1 step is 1.4504 psi.
const PSI_MIN = 14.5038 // = 1.0 bar
const PSI_MAX = 55.1144 // = 3.8 bar
const PSI_STEP = 1.4504 // = 0.1 bar

export const TUNE_FIELDS: readonly TuneField[] = [
  // Springs — per-car min/max; canonical lb/in.
  { id: 'springsFront', label: 'Front springs', section: 'springs', kind: 'number', unitCategory: 'springRate', tuneRef: 'springs' },
  { id: 'springsRear', label: 'Rear springs', section: 'springs', kind: 'number', unitCategory: 'springRate', tuneRef: 'springs' },

  // Dampers — FH6: 1.0–20.0, step 0.1.
  { id: 'bumpFront', label: 'Bump front', section: 'dampers', kind: 'number', min: 1, max: 20, step: 0.1, tuneRef: 'dampers' },
  { id: 'bumpRear', label: 'Bump rear', section: 'dampers', kind: 'number', min: 1, max: 20, step: 0.1, tuneRef: 'dampers' },
  { id: 'reboundFront', label: 'Rebound front', section: 'dampers', kind: 'number', min: 1, max: 20, step: 0.1, tuneRef: 'dampers' },
  { id: 'reboundRear', label: 'Rebound rear', section: 'dampers', kind: 'number', min: 1, max: 20, step: 0.1, tuneRef: 'dampers' },

  // Anti-roll bars — FH6: 1.00–65.00, step 0.10.
  { id: 'arbFront', label: 'Front ARB', section: 'arb', kind: 'number', min: 1, max: 65, step: 0.1, tuneRef: 'anti-roll-bars' },
  { id: 'arbRear', label: 'Rear ARB', section: 'arb', kind: 'number', min: 1, max: 65, step: 0.1, tuneRef: 'anti-roll-bars' },

  // Ride height — per-car min/max; canonical inches.
  { id: 'rideHeightFront', label: 'Front ride height', section: 'rideHeight', kind: 'number', unitCategory: 'distanceShortIn', tuneRef: 'ride-height' },
  { id: 'rideHeightRear', label: 'Rear ride height', section: 'rideHeight', kind: 'number', unitCategory: 'distanceShortIn', tuneRef: 'ride-height' },

  // Alignment — FH6: camber/toe −5.0 to 5.0 step 0.1; caster 1.0 to 7.0 step 0.1.
  { id: 'camberFront', label: 'Front camber', section: 'alignment', kind: 'number', unit: '°', min: -5, max: 5, step: 0.1, tuneRef: 'alignment' },
  { id: 'camberRear', label: 'Rear camber', section: 'alignment', kind: 'number', unit: '°', min: -5, max: 5, step: 0.1, tuneRef: 'alignment' },
  { id: 'casterFront', label: 'Caster', section: 'alignment', kind: 'number', unit: '°', min: 1, max: 7, step: 0.1, tuneRef: 'alignment' },
  { id: 'toeFront', label: 'Front toe', section: 'alignment', kind: 'number', unit: '°', min: -5, max: 5, step: 0.1, tuneRef: 'alignment' },
  { id: 'toeRear', label: 'Rear toe', section: 'alignment', kind: 'number', unit: '°', min: -5, max: 5, step: 0.1, tuneRef: 'alignment' },

  // Tire pressure — FH6: 1.0–3.8 bar, step 0.1 bar (converted to canonical psi above).
  { id: 'tirePressureFront', label: 'Front pressure', section: 'tirePressure', kind: 'number', unitCategory: 'pressure', min: PSI_MIN, max: PSI_MAX, step: PSI_STEP, tuneRef: 'tire-pressure' },
  { id: 'tirePressureRear', label: 'Rear pressure', section: 'tirePressure', kind: 'number', unitCategory: 'pressure', min: PSI_MIN, max: PSI_MAX, step: PSI_STEP, tuneRef: 'tire-pressure' },

  // Differential — FH6: 0–100%, step 1.
  { id: 'frontAccel', label: 'Front accel', section: 'differential', kind: 'number', unit: '%', min: 0, max: 100, step: 1, requiresDrivetrain: ['fwd', 'awd'], tuneRef: 'differential' },
  { id: 'frontDecel', label: 'Front decel', section: 'differential', kind: 'number', unit: '%', min: 0, max: 100, step: 1, requiresDrivetrain: ['fwd', 'awd'], tuneRef: 'differential' },
  { id: 'rearAccel', label: 'Rear accel', section: 'differential', kind: 'number', unit: '%', min: 0, max: 100, step: 1, requiresDrivetrain: ['rwd', 'awd'], tuneRef: 'differential' },
  { id: 'rearDecel', label: 'Rear decel', section: 'differential', kind: 'number', unit: '%', min: 0, max: 100, step: 1, requiresDrivetrain: ['rwd', 'awd'], tuneRef: 'differential' },
  { id: 'centerBalance', label: 'Center balance', section: 'differential', kind: 'number', unit: '% rear', min: 0, max: 100, step: 1, requiresDrivetrain: 'awd', tuneRef: 'center-diff' },

  // Brakes — FH6: balance 0–100% step 1; pressure 0–200% step 1.
  { id: 'brakeBalance', label: 'Brake balance', section: 'brakes', kind: 'number', unit: '% front', min: 0, max: 100, step: 1, tuneRef: 'brakes' },
  { id: 'brakePressure', label: 'Brake pressure', section: 'brakes', kind: 'number', unit: '%', min: 0, max: 200, step: 1, tuneRef: 'brakes' },

  // Aero — per-car max; canonical lb downforce.
  { id: 'aeroFront', label: 'Front aero', section: 'aero', kind: 'number', unitCategory: 'downforce', tuneRef: 'aero' },
  { id: 'aeroRear', label: 'Rear aero', section: 'aero', kind: 'number', unitCategory: 'downforce', tuneRef: 'aero' },

  // Gearing — FH6 final-drive slider: 2.20–6.10, step 0.01.
  { id: 'finalDrive', label: 'Final drive', section: 'gears', kind: 'number', min: 2.20, max: 6.10, step: 0.01, tuneRef: 'gearing' },

  // Freeform
  { id: 'notes', label: 'Notes', section: 'notes', kind: 'text' }
] as const

export function getTuneField(id: string): TuneField | undefined {
  return TUNE_FIELDS.find(f => f.id === id)
}

export function tuneFieldsBySection(drivetrain: string | null | undefined): Record<string, TuneField[]> {
  const out: Record<string, TuneField[]> = {}
  for (const f of visibleTuneFields(drivetrain)) {
    if (!out[f.section]) out[f.section] = []
    out[f.section]!.push(f)
  }
  return out
}

/** TuneSettings — derived from TUNE_FIELDS to stay in sync. */
export type TuneSettings = Partial<Record<typeof TUNE_FIELDS[number]['id'], string | number | null>>

// Re-export ALL_DRIVETRAINS for test fixtures.
export { ALL_DRIVETRAINS }
