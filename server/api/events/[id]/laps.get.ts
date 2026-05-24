import { asc, eq } from 'drizzle-orm'
import { db, schema } from 'hub:db'

/**
 * Flat lap list for an event — every lap across every session, ordered by
 * timeMs ascending so the picker on /compare can show "the fastest laps"
 * first. Used by the compare page's per-side lap dropdowns.
 *
 * Excludes laps with timeMs <= 0 (which the recorder can emit as placeholder
 * rows; they wouldn't make sense in a "pick a lap to compare" list).
 */
export default defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid event id' })
  }

  const eventRow = (await db
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(eq(schema.events.id, id))
    .limit(1))[0]

  if (!eventRow) {
    throw createError({ statusCode: 404, statusMessage: 'event not found' })
  }

  const laps = await db
    .select({
      lapId: schema.laps.id,
      lapNumber: schema.laps.lapNumber,
      timeMs: schema.laps.timeMs,
      sessionId: schema.sessions.id,
      tuneLabel: schema.sessions.tuneLabel,
      piAtStart: schema.sessions.piAtStart,
      startedAt: schema.sessions.startedAt,
      carOrdinal: schema.cars.ordinal,
      carClass: schema.cars.class,
      carDisplayName: schema.cars.displayName
    })
    .from(schema.laps)
    .innerJoin(schema.sessions, eq(schema.sessions.id, schema.laps.sessionId))
    .innerJoin(schema.cars, eq(schema.cars.id, schema.sessions.carId))
    .where(eq(schema.sessions.eventId, id))
    .orderBy(asc(schema.laps.timeMs))

  return { eventId: id, laps: laps.filter(l => l.timeMs > 0) }
})
