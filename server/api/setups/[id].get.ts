import { eq } from 'drizzle-orm'
import { db, schema } from 'hub:db'

export default defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid setup id' })
  }

  const row = (await db
    .select()
    .from(schema.setups)
    .where(eq(schema.setups.id, id))
    .limit(1))[0]

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'setup not found' })
  }
  return row
})
