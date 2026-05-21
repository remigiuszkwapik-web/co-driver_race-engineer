import { asc, eq } from 'drizzle-orm'
import { db, schema } from 'hub:db'

export default defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid session id' })
  }

  const session = (await db
    .select({
      sessionId: schema.sessions.id,
      eventId: schema.sessions.eventId,
      eventName: schema.events.name,
      eventType: schema.events.type,
      carId: schema.sessions.carId,
      carOrdinal: schema.cars.ordinal,
      carClass: schema.cars.class,
      carDisplayName: schema.cars.displayName,
      tuneLabel: schema.sessions.tuneLabel,
      piAtStart: schema.sessions.piAtStart,
      startedAt: schema.sessions.startedAt,
      endedAt: schema.sessions.endedAt,
      buildId: schema.sessions.buildId,
      buildSnapshot: schema.sessions.buildSnapshot,
      buildName: schema.builds.name,
      tuneId: schema.sessions.tuneId,
      tuneSnapshot: schema.sessions.tuneSnapshot,
      tuneName: schema.tunes.name
    })
    .from(schema.sessions)
    .innerJoin(schema.events, eq(schema.events.id, schema.sessions.eventId))
    .innerJoin(schema.cars, eq(schema.cars.id, schema.sessions.carId))
    .leftJoin(schema.builds, eq(schema.builds.id, schema.sessions.buildId))
    .leftJoin(schema.tunes, eq(schema.tunes.id, schema.sessions.tuneId))
    .where(eq(schema.sessions.id, id))
    .limit(1))[0]

  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'session not found' })
  }

  const laps = await db
    .select({
      id: schema.laps.id,
      lapNumber: schema.laps.lapNumber,
      timeMs: schema.laps.timeMs
    })
    .from(schema.laps)
    .where(eq(schema.laps.sessionId, id))
    .orderBy(asc(schema.laps.lapNumber))

  return { session, laps }
})
