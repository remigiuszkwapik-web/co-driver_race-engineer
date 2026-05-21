import { asc, eq } from 'drizzle-orm'
import { db, schema } from 'hub:db'

/**
 * List all setups for a car (ordinal), for the "copy from previous setup"
 * picker on SetupForm. Returns basic info per setup; full settings come
 * from /api/setups/[id] when one is selected.
 */
export default defineEventHandler(async (event) => {
  const ordinalParam = getRouterParam(event, 'ordinal')
  const ordinal = Number(ordinalParam)
  if (!Number.isInteger(ordinal) || ordinal <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid car ordinal' })
  }

  const car = (await db
    .select({ id: schema.cars.id })
    .from(schema.cars)
    .where(eq(schema.cars.ordinal, ordinal))
    .limit(1))[0]

  if (!car) return []

  const rows = await db
    .select({
      id: schema.setups.id,
      name: schema.setups.name,
      createdAt: schema.setups.createdAt
    })
    .from(schema.setups)
    .where(eq(schema.setups.carId, car.id))
    .orderBy(asc(schema.setups.createdAt))

  return rows
})
