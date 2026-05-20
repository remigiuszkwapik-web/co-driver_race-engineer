import { gunzipSync } from 'node:zlib'
import { asc, eq } from 'drizzle-orm'
import { db, schema } from 'hub:db'
import type { Telemetry } from '~~/server/utils/decode'
import { pointsFromFrames } from '~~/app/utils/track-map'

/**
 * Server-side path aggregation: unzip every lap's framesBlob, downsample to
 * TrackPoint[] per lap, return small JSON. Mirrors `sessions/[id]/dyno.get.ts`.
 * Payload is ~50–250KB for a typical session vs ~5MB of raw frames.
 */
export default defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid session id' })
  }

  const session = (await db
    .select({
      id: schema.sessions.id,
      eventId: schema.sessions.eventId,
      tuneLabel: schema.sessions.tuneLabel,
      piAtStart: schema.sessions.piAtStart,
      carOrdinal: schema.cars.ordinal,
      carClass: schema.cars.class,
      carDisplayName: schema.cars.displayName
    })
    .from(schema.sessions)
    .innerJoin(schema.cars, eq(schema.cars.id, schema.sessions.carId))
    .where(eq(schema.sessions.id, id))
    .limit(1))[0]

  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'session not found' })
  }

  const lapRows = await db
    .select({
      id: schema.laps.id,
      lapNumber: schema.laps.lapNumber,
      timeMs: schema.laps.timeMs,
      framesBlob: schema.laps.framesBlob
    })
    .from(schema.laps)
    .where(eq(schema.laps.sessionId, id))
    .orderBy(asc(schema.laps.lapNumber))

  const laps: Array<{
    lapNumber: number
    timeMs: number
    points: ReturnType<typeof pointsFromFrames>
  }> = []

  for (const lap of lapRows) {
    if (!lap.framesBlob) continue
    try {
      const json = gunzipSync(lap.framesBlob).toString('utf8')
      const frames = JSON.parse(json) as Telemetry[]
      const points = pointsFromFrames(frames)
      laps.push({ lapNumber: lap.lapNumber, timeMs: lap.timeMs, points })
    } catch (err) {
      console.error(`[path] failed to unzip lap ${lap.id}:`, err)
    }
  }

  return {
    sessionId: session.id,
    eventId: session.eventId,
    tuneLabel: session.tuneLabel,
    piAtStart: session.piAtStart,
    car: {
      ordinal: session.carOrdinal,
      class: session.carClass,
      displayName: session.carDisplayName
    },
    laps
  }
})
