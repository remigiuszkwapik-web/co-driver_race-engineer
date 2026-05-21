import { eq } from 'drizzle-orm'
import { db, schema } from 'hub:db'

interface PatchBody {
  name?: unknown
  build?: unknown
  tune?: unknown
}

/**
 * Edit a named setup. Updating the setup row does NOT mutate any
 * historical session snapshots — those are immutable per-session copies.
 */
export default defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid setup id' })
  }

  const body = await readBody<PatchBody>(event)
  if (!body) {
    throw createError({ statusCode: 400, statusMessage: 'body required' })
  }

  const updates: Partial<typeof schema.setups.$inferInsert> = {}

  if ('name' in body) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'name must be a non-empty string' })
    }
    updates.name = body.name.trim()
  }
  if ('build' in body) {
    if (body.build === null || typeof body.build !== 'object') {
      throw createError({ statusCode: 400, statusMessage: 'build must be an object' })
    }
    updates.build = body.build
  }
  if ('tune' in body) {
    if (body.tune !== null && typeof body.tune !== 'object') {
      throw createError({ statusCode: 400, statusMessage: 'tune must be an object or null' })
    }
    updates.tune = body.tune as Record<string, unknown> | null
  }

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'no fields to update' })
  }

  try {
    const updated = await db
      .update(schema.setups)
      .set(updates)
      .where(eq(schema.setups.id, id))
      .returning()

    if (updated.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'setup not found' })
    }
    return updated[0]!
  } catch (err) {
    const e = err as { message?: string, statusCode?: number }
    if (e.statusCode) throw err
    if (e.message?.includes('UNIQUE')) {
      throw createError({ statusCode: 409, statusMessage: 'setup name already exists for this car' })
    }
    throw err
  }
})
