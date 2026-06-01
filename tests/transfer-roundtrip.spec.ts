import { expect, test } from '@nuxt/test-utils/playwright'
import { encodeFrames } from '../server/utils/frames-codec'
import type { Telemetry, Quad } from '../server/utils/decode'

/**
 * Lap export → import round-trip, end to end through the real endpoints + DB.
 *
 * Builds a synthetic, sentinel-keyed lap bundle (identical in shape to what
 * /api/laps/[id]/export?format=bundle emits), imports it, then exports the
 * freshly-created lap and asserts *every* entity survived — car, event, build,
 * tune, session and the frames blob (byte-for-byte). Then re-imports to prove
 * merge-by-identity is idempotent (nothing duplicated). All rows it creates are
 * removed afterwards via the car-delete cascade + event delete, and a
 * best-effort pre-clean handles leftovers from a previously-aborted run.
 *
 * This is the test that answers "if I export and import, is all the data
 * there?" — the codec-level guarantee is in test/unit/lap-export.test.ts; this
 * proves the wiring around it.
 */

const SENTINEL = '__codriver_roundtrip_test'
const ORDINAL = 9_900_001
const EVENT_TYPE = 'custom'

function frame(i: number): Telemetry {
  const q = (b: number): Quad => ({ fl: b, fr: b + 0.1, rl: b + 0.2, rr: b + 0.3 })
  return {
    isRaceOn: true,
    timestampMs: i * (1000 / 60),
    rpm: 6000 + i, rpmMax: 8000, rpmIdle: 900,
    speedKmh: 140.25, power: 120000, torque: 320, boost: 0.8,
    gear: 4, throttle: 0.5, brake: 0.25, clutch: 0, handBrake: 0, steer: -0.1,
    drivingLine: 5, aiBrakeDifference: -3,
    suspension: q(0.5), suspensionMeters: q(0.05), slipRatio: q(0.05), slipAngle: q(0.11), combinedSlip: q(0.11), tireTempC: q(85),
    wheelRotation: q(120), rumble: null, puddle: null,
    yaw: 0.12, pitch: 0.01, roll: 0.02,
    position: { x: 100 + i, y: 5, z: 200 + i },
    velocity: { x: 38, y: 0, z: 1 },
    acceleration: { x: 2, y: 0.1, z: 9.8 },
    angularVelocity: { x: 0, y: 0.27, z: 0 },
    car: { ordinal: ORDINAL, class: 5, pi: 800, drivetrain: 2, cylinders: 8 },
    lap: { number: 1, racePosition: 1, current: i * 0.016, last: 0, best: 0, raceTime: i * 0.016, distance: i * 0.6 },
    fuel: 0.95, rawLength: 324
  }
}

const framesB64 = encodeFrames(Array.from({ length: 20 }, (_, i) => frame(i))).toString('base64')

const bundle = {
  format: 'co-driver-lap',
  version: 1,
  event: { name: `${SENTINEL}_event`, type: EVENT_TYPE },
  car: { ordinal: ORDINAL, class: 5, displayName: `${SENTINEL} Car` },
  build: { name: `${SENTINEL}_build`, settings: { tires: 'race', diff: 55 } },
  tune: { name: `${SENTINEL}_tune`, settings: { rearSpring: 12.3 } },
  session: {
    tuneLabel: `${SENTINEL}_label`,
    piAtStart: 798,
    startedAt: '2026-06-01T09:15:30.000Z',
    endedAt: '2026-06-01T09:18:00.000Z',
    buildSnapshot: null,
    tuneSnapshot: null
  },
  lap: { lapNumber: 1, timeMs: 88123, framesB64 }
}

test('lap export → import round-trips every entity', async ({ page, goto, request }) => {
  // Resolve the live server origin so API calls hit the same instance the
  // nuxt fixture serves, regardless of port.
  await goto('/', { waitUntil: 'commit' })
  const origin = new URL(page.url()).origin
  const api = (p: string) => origin + p

  const findEventId = async (): Promise<number | null> => {
    const events = await (await request.get(api('/api/events'))).json() as { id: number, name: string, type: string }[]
    return events.find(e => e.name === bundle.event.name && e.type === EVENT_TYPE)?.id ?? null
  }
  const cleanup = async () => {
    await request.delete(api(`/api/cars/${ORDINAL}`)).catch(() => {})
    const evId = await findEventId().catch(() => null)
    if (evId) await request.delete(api(`/api/events/${evId}`)).catch(() => {})
  }

  await cleanup() // clear any leftovers from an aborted previous run
  try {
    // ---- first import: creates the whole chain ----------------------------
    const importRes = await request.post(api('/api/laps/import'), { data: bundle })
    expect(importRes.ok()).toBeTruthy()
    const imported = await importRes.json()
    expect(imported.alreadyPresent).toBe(false)
    expect(imported.created).toEqual({ car: true, event: true, build: true, tune: true, session: true })
    const lapId = imported.lapId as number

    // ---- export the freshly-created lap and verify all data survived ------
    const exportRes = await request.get(api(`/api/laps/${lapId}/export?format=bundle`))
    expect(exportRes.ok()).toBeTruthy()
    const out = await exportRes.json()

    expect(out.format).toBe('co-driver-lap')
    expect(out.version).toBe(1)
    expect(out.event).toEqual(bundle.event)
    expect(out.car).toEqual(bundle.car)
    expect(out.build).toEqual(bundle.build)
    expect(out.tune).toEqual(bundle.tune)
    expect(out.session.tuneLabel).toBe(bundle.session.tuneLabel)
    expect(out.session.piAtStart).toBe(bundle.session.piAtStart)
    expect(new Date(out.session.startedAt).toISOString()).toBe(bundle.session.startedAt)
    expect(new Date(out.session.endedAt).toISOString()).toBe(bundle.session.endedAt)
    expect(out.lap.lapNumber).toBe(bundle.lap.lapNumber)
    expect(out.lap.timeMs).toBe(bundle.lap.timeMs)
    // frames blob is carried verbatim — byte-for-byte, no re-encode
    expect(out.lap.framesB64).toBe(bundle.lap.framesB64)

    // ---- re-import: idempotent, merge-by-identity reuses everything -------
    const second = await (await request.post(api('/api/laps/import'), { data: bundle })).json()
    expect(second.alreadyPresent).toBe(true)
    expect(second.created).toEqual({ car: false, event: false, build: false, tune: false, session: false })
    expect(second.lapId).toBe(lapId)
  } finally {
    await cleanup()
  }
})
