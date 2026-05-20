import { eq } from 'drizzle-orm'
import { db, schema } from 'hub:db'

interface PatchBody {
  tuneLabel?: unknown
}

export default defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid session id' })
  }

  const body = await readBody<PatchBody>(event)
  if (!body || !('tuneLabel' in body)) {
    throw createError({ statusCode: 400, statusMessage: 'tuneLabel required' })
  }
  const raw = body.tuneLabel
  if (raw !== null && typeof raw !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'tuneLabel must be a string or null' })
  }

  // Empty-after-trim → null so the UI's "—" placeholder shows.
  const tuneLabel = raw === null ? null : (raw.trim() || null)

  const updated = await db
    .update(schema.sessions)
    .set({ tuneLabel })
    .where(eq(schema.sessions.id, id))
    .returning()

  if (updated.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'session not found' })
  }
  return updated[0]!
})
