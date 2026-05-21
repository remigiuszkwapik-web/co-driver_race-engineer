import { eq } from 'drizzle-orm'
import { db, schema } from 'hub:db'

interface PostBody {
  name?: unknown
  build?: unknown
  tune?: unknown
}

export default defineEventHandler(async (event) => {
  const ordinalParam = getRouterParam(event, 'ordinal')
  const ordinal = Number(ordinalParam)
  if (!Number.isInteger(ordinal) || ordinal <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid car ordinal' })
  }

  const body = await readBody<PostBody>(event)
  if (!body || typeof body.name !== 'string' || !body.name.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name required' })
  }
  const name = body.name.trim()
  const build = body.build && typeof body.build === 'object' ? body.build : {}
  const tune = body.tune && typeof body.tune === 'object' ? body.tune : null

  const car = (await db
    .select({ id: schema.cars.id })
    .from(schema.cars)
    .where(eq(schema.cars.ordinal, ordinal))
    .limit(1))[0]

  if (!car) {
    throw createError({ statusCode: 404, statusMessage: 'car not found' })
  }

  try {
    const inserted = await db
      .insert(schema.setups)
      .values({ carId: car.id, name, build, tune })
      .returning()

    return inserted[0]!
  } catch (err) {
    const e = err as { message?: string }
    if (e.message?.includes('UNIQUE')) {
      throw createError({ statusCode: 409, statusMessage: 'setup name already exists for this car' })
    }
    throw err
  }
})
