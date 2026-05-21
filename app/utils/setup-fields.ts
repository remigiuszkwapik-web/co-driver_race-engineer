/**
 * Setup field metadata. Phase 1 ships the BUILD section; Phase 1b will
 * append TUNE field metadata to this same module.
 *
 * The fields are ForzaTune-aligned *calculation inputs* / vehicle specs,
 * not an exhaustive upgrade catalog. See WISHLIST.md / the plan file for
 * the philosophy: measurement-not-prescription, player-centric language,
 * build = the outcomes of upgrade choices.
 */

export type FieldKind = 'number' | 'enum' | 'text'

/**
 * How a field's default value gets pre-filled when the form opens.
 * The form is responsible for resolving these sources; this module just
 * declares them.
 */
export type AutoSource = 'dyno_peak_power' | 'session_pi' | 'car_class' | 'car_drivetrain'

export interface SetupField {
  /** Stable identifier; also the JSON path under `build.*`. */
  id: string
  /** Player-centric label rendered in the form + display. Neutral
   *  language: "Tire compound" not "Best tire compound." */
  label: string
  /** Section name — for Phase 1b grouping; v1 renders everything under
   *  the single "Build" group, but the field declarations carry the
   *  intended section so the metadata is forwards-compatible. */
  section: string
  /** Kind of input. */
  kind: FieldKind
  /** Optional units suffix shown next to the field (" HP", " kg",
   *  " mm", " % front"). */
  unit?: string
  /** For enum fields: the allowed values in display order. */
  options?: readonly string[]
  /** Auto-populate source if this field can pre-fill from existing data. */
  auto?: AutoSource
  /** Optional /tune reference page slug for "see also" linking. */
  tuneRef?: string
}

export const BUILD_FIELDS: readonly SetupField[] = [
  {
    id: 'power',
    label: 'Power',
    section: 'engine',
    kind: 'number',
    unit: ' HP',
    auto: 'dyno_peak_power'
  },
  {
    id: 'weight',
    label: 'Weight',
    section: 'chassis',
    kind: 'number',
    unit: ' kg'
  },
  {
    id: 'weightFrontPct',
    label: 'Weight distribution',
    section: 'chassis',
    kind: 'number',
    unit: ' % front'
  },
  {
    id: 'pi',
    label: 'PI',
    section: 'class',
    kind: 'number',
    auto: 'session_pi'
  },
  {
    id: 'carClass',
    label: 'Class',
    section: 'class',
    kind: 'enum',
    options: ['D', 'C', 'B', 'A', 'S1', 'S2', 'X', 'R'],
    auto: 'car_class'
  },
  {
    id: 'drivetrain',
    label: 'Drivetrain',
    section: 'engine',
    kind: 'enum',
    options: ['fwd', 'rwd', 'awd'],
    auto: 'car_drivetrain'
  },
  {
    id: 'tireCompound',
    label: 'Tire compound',
    section: 'tires',
    kind: 'enum',
    options: ['stock', 'street', 'sport', 'semi_slick', 'race', 'rally', 'drag', 'off_road'],
    tuneRef: 'tire-pressure'
  },
  {
    id: 'tireWidthFront',
    label: 'Front tire width',
    section: 'tires',
    kind: 'number',
    unit: ' mm'
  },
  {
    id: 'tireWidthRear',
    label: 'Rear tire width',
    section: 'tires',
    kind: 'number',
    unit: ' mm'
  },
  {
    id: 'aero',
    label: 'Aero',
    section: 'aero',
    kind: 'enum',
    options: ['none', 'splitter', 'wing', 'both'],
    tuneRef: 'aero'
  },
  {
    id: 'engineSwap',
    label: 'Engine swap',
    section: 'engine',
    kind: 'text'
  },
  {
    id: 'notes',
    label: 'Notes',
    section: 'misc',
    kind: 'text'
  }
] as const

export function getBuildField(id: string): SetupField | undefined {
  return BUILD_FIELDS.find(f => f.id === id)
}

/** Map of carClass options for display formatting. */
export const CLASS_LABELS: Record<string, string> = {
  D: 'D', C: 'C', B: 'B', A: 'A', S1: 'S1', S2: 'S2', X: 'X', R: 'R'
}

/** Map of drivetrain enum to display strings. */
export const DRIVETRAIN_LABELS: Record<string, string> = {
  fwd: 'FWD', rwd: 'RWD', awd: 'AWD'
}

/** Map of tire compound enum to display strings. */
export const TIRE_COMPOUND_LABELS: Record<string, string> = {
  stock: 'Stock',
  street: 'Street',
  sport: 'Sport',
  semi_slick: 'Semi-slick',
  race: 'Race',
  rally: 'Rally',
  drag: 'Drag',
  off_road: 'Off-road'
}

/** Map of aero enum to display strings. */
export const AERO_LABELS: Record<string, string> = {
  none: 'None',
  splitter: 'Front splitter',
  wing: 'Rear wing',
  both: 'Splitter + wing'
}

/** Format a field's value for SetupDisplay. Returns '—' for nullish. */
export function formatFieldValue(field: SetupField, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'

  if (field.kind === 'enum') {
    const stringValue = String(value)
    switch (field.id) {
      case 'carClass': return CLASS_LABELS[stringValue] ?? stringValue
      case 'drivetrain': return DRIVETRAIN_LABELS[stringValue] ?? stringValue
      case 'tireCompound': return TIRE_COMPOUND_LABELS[stringValue] ?? stringValue
      case 'aero': return AERO_LABELS[stringValue] ?? stringValue
      default: return stringValue
    }
  }

  if (field.kind === 'number') {
    const n = Number(value)
    if (!Number.isFinite(n)) return '—'
    const rounded = Number.isInteger(n) ? n.toString() : n.toFixed(1)
    return rounded + (field.unit ?? '')
  }

  return String(value)
}

/** Build object shape — derived from BUILD_FIELDS to stay in sync. */
export type BuildSettings = Partial<Record<typeof BUILD_FIELDS[number]['id'], string | number | null>>
