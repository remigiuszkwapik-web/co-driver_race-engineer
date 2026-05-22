/**
 * Setup diff — walks BUILD_FIELDS + TUNE_FIELDS for two sessions' snapshots
 * and returns the rows that differ between them. Pure module.
 *
 * The output is a flat list of changed fields grouped by section, formatted
 * via the same `formatFieldValue` helper the rest of the UI uses so labels
 * read consistently across SessionCompare, BuildDisplay, TuneDisplay.
 */

import {
  BUILD_FIELDS,
  formatFieldValue,
  type BuildSettings
} from './build-fields'
import {
  TUNE_FIELDS,
  type TuneSettings
} from './tune-fields'

export interface SetupDiffRow {
  /** Where the field came from — for grouping ("Build · springs" vs "Tune · springs"). */
  source: 'build' | 'tune'
  /** Section identifier (e.g. 'springs'). */
  section: string
  /** Field label as rendered in the UI (e.g. 'Front springs'). */
  fieldLabel: string
  /** Field id (for keying lists). */
  fieldId: string
  /** Already-formatted value strings. */
  currentValue: string
  priorValue: string
}

/** Section labels rendered for the diff row prefix. */
export const SOURCE_LABEL: Record<'build' | 'tune', string> = {
  build: 'Build',
  tune: 'Tune'
}

function normalize(v: unknown): string | number | null {
  if (v === null || v === undefined) return null
  if (v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  return v as string | number
}

function bothNullish(a: unknown, b: unknown): boolean {
  return normalize(a) === null && normalize(b) === null
}

function equals(a: unknown, b: unknown): boolean {
  const na = normalize(a)
  const nb = normalize(b)
  if (na === null && nb === null) return true
  if (na === null || nb === null) return false
  return na === nb
}

export function diffSetup(
  current: { build: BuildSettings | null, tune: TuneSettings | null },
  prior: { build: BuildSettings | null, tune: TuneSettings | null }
): SetupDiffRow[] {
  const out: SetupDiffRow[] = []

  for (const field of BUILD_FIELDS) {
    const c = current.build?.[field.id as keyof BuildSettings] ?? null
    const p = prior.build?.[field.id as keyof BuildSettings] ?? null
    if (bothNullish(c, p)) continue
    if (equals(c, p)) continue
    out.push({
      source: 'build',
      section: field.section,
      fieldLabel: field.label,
      fieldId: field.id,
      currentValue: formatFieldValue(field, c),
      priorValue: formatFieldValue(field, p)
    })
  }

  for (const field of TUNE_FIELDS) {
    const c = current.tune?.[field.id as keyof TuneSettings] ?? null
    const p = prior.tune?.[field.id as keyof TuneSettings] ?? null
    if (bothNullish(c, p)) continue
    if (equals(c, p)) continue
    out.push({
      source: 'tune',
      section: field.section,
      fieldLabel: field.label,
      fieldId: field.id,
      currentValue: formatFieldValue(field, c),
      priorValue: formatFieldValue(field, p)
    })
  }

  return out
}
