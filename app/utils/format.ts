/**
 * Format a lap time in milliseconds as M:SS.mmm.
 *
 * Returns "—" for null/undefined so callers can drop in placeholder cells.
 */
export function formatLap(ms: number | null | undefined): string {
  if (ms == null) return '—'
  const totalSeconds = ms / 1000
  const m = Math.floor(totalSeconds / 60)
  const s = (totalSeconds - m * 60).toFixed(3).padStart(6, '0')
  return `${m}:${s}`
}
