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

/**
 * Format a signed lap-time delta in milliseconds as +S.mmm / −S.mmm.
 *
 * Uses Unicode minus (U+2212) for typographic match with the zinc UI.
 * Sub-millisecond noise is suppressed with a "0.000" zero label.
 */
export function formatDelta(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  if (Math.abs(ms) < 0.5) return '0.000'
  const sign = ms > 0 ? '+' : '−'
  return `${sign}${(Math.abs(ms) / 1000).toFixed(3)}`
}

/**
 * Format an ISO date string as a short relative phrase ("today,"
 * "2 days ago," "3 months ago"). Returns "—" for null.
 */
export function relativeDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return '—'
  const days = Math.round((Date.now() - then) / 86400000)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  if (days < 365) return `${Math.round(days / 30)} months ago`
  return `${Math.round(days / 365)} years ago`
}
