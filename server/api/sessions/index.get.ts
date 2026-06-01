import { asc, desc, eq, inArray } from 'drizzle-orm'
import { db, schema } from 'hub:db'

/**
 * Every recorded session with its car + event context and a thin lap list,
 * newest first. Feeds the Transfer page, which groups these by car and exposes
 * per-lap export. Laps are fetched in one batched query and grouped in JS to
 * avoid the row fan-out of a session⋈lap join.
 */
export default defineEventHandler(async () => {
  const sessions = await db
    .select({
      sessionId: schema.sessions.id,
      carId: schema.sessions.carId,
      carOrdinal: schema.cars.ordinal,
      carClass: schema.cars.class,
      carDisplayName: schema.cars.displayName,
      eventId: schema.sessions.eventId,
      eventName: schema.events.name,
      eventType: schema.events.type,
      tuneLabel: schema.sessions.tuneLabel,
      piAtStart: schema.sessions.piAtStart,
      startedAt: schema.sessions.startedAt,
      endedAt: schema.sessions.endedAt
    })
    .from(schema.sessions)
    .innerJoin(schema.events, eq(schema.events.id, schema.sessions.eventId))
    .innerJoin(schema.cars, eq(schema.cars.id, schema.sessions.carId))
    .orderBy(desc(schema.sessions.startedAt))

  if (sessions.length === 0) return []

  const lapRows = await db
    .select({
      id: schema.laps.id,
      sessionId: schema.laps.sessionId,
      lapNumber: schema.laps.lapNumber,
      timeMs: schema.laps.timeMs
    })
    .from(schema.laps)
    .where(inArray(schema.laps.sessionId, sessions.map(s => s.sessionId)))
    .orderBy(asc(schema.laps.lapNumber))

  const lapsBySession = new Map<number, typeof lapRows>()
  for (const lap of lapRows) {
    const list = lapsBySession.get(lap.sessionId) ?? []
    list.push(lap)
    lapsBySession.set(lap.sessionId, list)
  }

  return sessions.map(s => ({
    ...s,
    laps: (lapsBySession.get(s.sessionId) ?? []).map(({ id, lapNumber, timeMs }) => ({ id, lapNumber, timeMs }))
  }))
})
