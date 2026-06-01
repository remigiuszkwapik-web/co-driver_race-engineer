/**
 * Trigger a browser download for a same-origin URL. The server sets
 * `Content-Disposition: attachment`, so a transient anchor click is enough —
 * no blob fetch or object URL needed. Used by the Transfer page's per-lap
 * export buttons against /api/laps/[id]/export?format=…
 */
export function downloadUrl(url: string): void {
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener'
  // Let the server's Content-Disposition filename win; the empty attribute just
  // forces the download path rather than a navigation.
  a.download = ''
  document.body.appendChild(a)
  a.click()
  a.remove()
}
