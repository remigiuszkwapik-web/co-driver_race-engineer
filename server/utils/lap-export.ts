/**
 * Pure serializers for the four lap export formats. Kept out of the HTTP
 * endpoint so they're unit-testable without a request:
 *   - toCsv       generic, one row per frame, unit in the header — opens
 *                 anywhere (Excel, pandas, MyRaceLab)
 *   - toMotecCsv  MoTeC i2's CSV dialect (fully quoted, metadata header block)
 *   - toBundle    native co-driver envelope; carries the frames blob verbatim
 *                 (base64) so an import is lossless and re-encode-free
 * Raw JSON has no serializer here — the endpoint returns the decoded frames +
 * metadata object directly.
 */
import type { Telemetry } from './decode'
import { LAP_CHANNELS } from './lap-channels'

export const BUNDLE_FORMAT = 'co-driver-lap'
export const BUNDLE_VERSION = 1

export interface LapMeta {
  event: { name: string, type: string }
  car: { ordinal: number, class: number, displayName: string | null }
  build: { name: string, settings: unknown } | null
  tune: { name: string, settings: unknown } | null
  session: {
    tuneLabel: string | null
    piAtStart: number
    startedAt: Date | number | string | null
    endedAt: Date | number | string | null
    buildSnapshot: unknown
    tuneSnapshot: unknown
  }
  lap: { lapNumber: number, timeMs: number }
}

/** Up to 4 decimals, trailing zeros stripped; empty string for absent channels. */
function num(v: number | null): string {
  if (v == null || Number.isNaN(v)) return ''
  return Number.parseFloat(v.toFixed(4)).toString()
}

const CRLF = '\r\n'

export function toCsv(frames: Telemetry[], t0: number): string {
  const header = LAP_CHANNELS.map(c => (c.unit ? `${c.name} (${c.unit})` : c.name)).join(',')
  const rows = [header]
  for (const f of frames) {
    rows.push(LAP_CHANNELS.map(c => num(c.get(f, t0))).join(','))
  }
  return rows.join(CRLF) + CRLF
}

// MoTeC i2 expects every field quoted (a comma decimal separator in some locales
// otherwise corrupts the parse) and a "key","value" metadata block ahead of the
// channel/unit header. Layout reconstructed from MoTeC forum guidance — verify
// against a real i2 CSV export if import is fussy.
function q(s: string | number): string {
  return `"${String(s).replace(/"/g, '""')}"`
}

function asDate(v: Date | number | string | null): Date | null {
  if (v == null) return null
  if (v instanceof Date) return v
  // libsql timestamps come back as Date via drizzle; numbers are unix seconds.
  if (typeof v === 'number') return new Date(v * 1000)
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export function toMotecCsv(frames: Telemetry[], t0: number, meta: LapMeta): string {
  const last = frames.at(-1)
  const durationS = last ? (last.timestampMs - t0) / 1000 : 0
  const sampleHz = frames.length > 1 && durationS > 0
    ? Math.round((frames.length - 1) / durationS)
    : 0
  const started = asDate(meta.session.startedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const logDate = started
    ? `${pad(started.getUTCDate())}/${pad(started.getUTCMonth() + 1)}/${started.getUTCFullYear()}`
    : ''
  const logTime = started
    ? `${pad(started.getUTCHours())}:${pad(started.getUTCMinutes())}:${pad(started.getUTCSeconds())}`
    : ''

  const rows: string[] = [
    [q('Format'), q('MoTeC CSV File')].join(','),
    [q('Venue'), q(meta.event.name)].join(','),
    [q('Vehicle'), q(meta.car.displayName ?? `Car ${meta.car.ordinal}`)].join(','),
    [q('Driver'), q('')].join(','),
    [q('Comment'), q(meta.session.tuneLabel ?? '')].join(','),
    [q('Log Date'), q(logDate)].join(','),
    [q('Log Time'), q(logTime)].join(','),
    [q('Sample Rate'), q(sampleHz)].join(','),
    [q('Duration'), q(num(durationS))].join(','),
    '',
    LAP_CHANNELS.map(c => q(c.name)).join(','),
    LAP_CHANNELS.map(c => q(c.unit)).join(','),
    ''
  ]
  for (const f of frames) {
    rows.push(LAP_CHANNELS.map(c => q(num(c.get(f, t0)))).join(','))
  }
  return rows.join(CRLF) + CRLF
}

export function toBundle(meta: LapMeta, framesB64: string): Record<string, unknown> {
  return {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    event: meta.event,
    car: meta.car,
    build: meta.build,
    tune: meta.tune,
    session: meta.session,
    lap: { lapNumber: meta.lap.lapNumber, timeMs: meta.lap.timeMs, framesB64 }
  }
}
