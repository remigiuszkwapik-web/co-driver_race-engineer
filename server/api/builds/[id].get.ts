import { eq, sql } from 'drizzle-orm'
import { db, schema } from 'hub:db'

export default defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid build id' })
  }

  const row = (await db
    .select({
      id: schema.builds.id,
      carId: schema.builds.carId,
      carOrdinal: schema.cars.ordinal,
      carClass: schema.cars.class,
      carDisplayName: schema.cars.displayName,
      name: schema.builds.name,
      settings: schema.builds.settings,
      createdAt: schema.builds.createdAt,
      tuneCount: sql<number>`(SELECT COUNT(*) FROM ${schema.tunes} WHERE ${schema.tunes.buildId} = ${schema.builds.id})`,
      sessionCount: sql<number>`(SELECT COUNT(*) FROM ${schema.sessions} WHERE ${schema.sessions.buildId} = ${schema.builds.id})`
    })
    .from(schema.builds)
    .innerJoin(schema.cars, eq(schema.cars.id, schema.builds.carId))
    .where(eq(schema.builds.id, id))
    .limit(1))[0]

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'build not found' })
  }

  return {
    ...row,
    tuneCount: Number(row.tuneCount) || 0,
    sessionCount: Number(row.sessionCount) || 0
  }
})
