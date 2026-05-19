/**
 * Tuning thresholds and color helpers for the corner view.
 * Hardcoded for v1; a settings panel in v2 will move these to user config.
 */

export const TIRE_TEMP_COLD_C = 80
export const TIRE_TEMP_HOT_C = 95

export const SUSPENSION_WARNING = 0.80
export const SUSPENSION_BOTTOMING = 0.95

export const SLIP_THRESHOLD = 0.10

const GREEN = '#22c55e'
const TEAL = '#14b8a6'
const AMBER = '#f59e0b'
const RED = '#ef4444'
const BLUE = '#3b82f6'
const ZINC = '#52525b'

export function tempColor(c: number): string {
  if (c < TIRE_TEMP_COLD_C - 20) return BLUE
  if (c < TIRE_TEMP_COLD_C) return TEAL
  if (c <= TIRE_TEMP_HOT_C) return GREEN
  if (c <= TIRE_TEMP_HOT_C + 15) return AMBER
  return RED
}

export function suspColor(normalized: number): string {
  if (normalized > SUSPENSION_BOTTOMING) return RED
  if (normalized > SUSPENSION_WARNING) return AMBER
  return GREEN
}

export function slipColor(absSlip: number): string {
  if (absSlip > SLIP_THRESHOLD * 2) return RED
  if (absSlip > SLIP_THRESHOLD) return AMBER
  return ZINC
}

/** Forza gear u8 → human label. 0=R, 1=N, 2=1st, ... */
export function gearLabel(g: number): string {
  if (g === 0) return 'R'
  if (g === 1) return 'N'
  return String(g - 1)
}
