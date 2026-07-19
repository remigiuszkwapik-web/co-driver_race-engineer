import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from 'hub:db'
import type { Telemetry } from '~~/server/utils/decode'
import { decodeFrames } from '~~/server/utils/frames-codec'
import { summarizeFrames } from '~~/app/utils/tune-signals'
import { summarizeSession, type SessionSummary } from '~~/app/utils/engineer-progress'
import type { BuildSettings } from '~~/app/utils/build-fields'

/**
 * Session-over-session progress for the Race Engineer's "Since your last
 * session" card. Resolves the car (?car=<ordinal>, else the most-recent
 * session's car), takes the two most recent sessions for that car, and boils
 * each down to a comparable SessionSummary. The plain-language diff is done
 * client-side by progressHints().
 */

type Drivetrain = 'fwd' | 'rwd' | 'awd' | null

function readDrivetrain(snapshot: BuildSettings | null | undefined): Drivetrain {
  if (!snapshot) return null
  const v = (snapshot as Record<string, unknown>).drivetrain
  return v === 'fwd' || v === 'rwd' || v === 'awd' ? v : null
}

async function summariseSession(sessionId: number, drivetrain: Drivetrain): Promise<SessionSummary | null> {
  const lapRows = await db
    .select({ id: schema.laps.id, timeMs: schema.laps.timeMs, framesBlob: schema.laps.framesBlob })
    .from(schema.laps)
    .where(eq(schema.laps.sessionId, sessionId))
    .orderBy(desc(schema.laps.id))

  const frames: Telemetry[] = []
  let bestLapMs = 0
  let lapCount = 0
  for (const lap of lapRows) {
    if (!lap.framesBlob || lap.timeMs <= 0) continue
    try {
      for (const f of decodeFrames(lap.framesBlob)) frames.push(f)
      lapCount++
      if (bestLapMs === 0 || lap.timeMs < bestLapMs) bestLapMs = lap.timeMs
    } catch (err) {
      console.error(`[progress] failed to read lap ${lap.id}:`, err)
    }
  }
  if (frames.length === 0) return null
  return summarizeSession(summarizeFrames(frames), drivetrain, bestLapMs, lapCount)
}

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const carOrdinalParam = q.car != null ? Number(q.car) : null

  let carId: number | null = null
  let carOrdinal: number | null = null
  let carDisplayName: string | null = null
  let carClass: number | null = null

  if (carOrdinalParam !== null && Number.isFinite(carOrdinalParam)) {
    const car = (await db
      .select({ id: schema.cars.id, ordinal: schema.cars.ordinal, displayName: schema.cars.displayName, class: schema.cars.class })
      .from(schema.cars)
      .where(and(eq(schema.cars.gameId, 'fh6'), eq(schema.cars.ordinal, carOrdinalParam)))
      .limit(1))[0]
    if (car) {
      carId = car.id
      carOrdinal = car.ordinal
      carDisplayName = car.displayName
      carClass = car.class
    }
  }

  // Two most recent sessions for the car (or the latest overall when no car arg).
  const sessions = await db
    .select({
      id: schema.sessions.id,
      buildId: schema.sessions.buildId,
      carId: schema.sessions.carId,
      carOrdinal: schema.cars.ordinal,
      carDisplayName: schema.cars.displayName,
      carClass: schema.cars.class
    })
    .from(schema.sessions)
    .leftJoin(schema.cars, eq(schema.cars.id, schema.sessions.carId))
    .where(carId !== null ? eq(schema.sessions.carId, carId) : undefined)
    .orderBy(desc(schema.sessions.startedAt))
    .limit(2)

  if (sessions.length === 0) {
    return { car: null, drivetrain: null, current: null, previous: null }
  }

  const head = sessions[0]!
  if (carOrdinal === null) {
    carOrdinal = head.carOrdinal
    carDisplayName = head.carDisplayName
    carClass = head.carClass
  }

  // Drivetrain from the current session's build settings.
  let drivetrain: Drivetrain = null
  if (head.buildId !== null) {
    const b = (await db
      .select({ settings: schema.builds.settings })
      .from(schema.builds)
      .where(eq(schema.builds.id, head.buildId))
      .limit(1))[0]
    drivetrain = readDrivetrain(b?.settings as BuildSettings | null | undefined)
  }

  const current = await summariseSession(head.id, drivetrain)
  const previous = sessions[1] ? await summariseSession(sessions[1].id, drivetrain) : null

  return {
    car: carOrdinal !== null ? { ordinal: carOrdinal, displayName: carDisplayName, class: carClass } : null,
    drivetrain,
    current,
    previous
  }
})
