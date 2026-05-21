import { eq } from 'drizzle-orm'
import { db, schema } from 'hub:db'

interface PatchBody {
  tuneLabel?: unknown
  setupId?: unknown
  setupSnapshot?: unknown
}

/**
 * Edit a session. Supports updating:
 * - tuneLabel (back-compat string label)
 * - setupId (attach a named setup; if no explicit snapshot is provided,
 *   server copies the setup's current { build, tune } as the immutable
 *   snapshot for this session)
 * - setupSnapshot (override the snapshot directly — used when the
 *   client mutates a session's setup state without rewriting the named
 *   setup row)
 *
 * setupId can be set to null to detach.
 */
export default defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid session id' })
  }

  const body = await readBody<PatchBody>(event)
  if (!body) {
    throw createError({ statusCode: 400, statusMessage: 'body required' })
  }

  const updates: Partial<typeof schema.sessions.$inferInsert> = {}

  if ('tuneLabel' in body) {
    const raw = body.tuneLabel
    if (raw !== null && typeof raw !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'tuneLabel must be a string or null' })
    }
    updates.tuneLabel = raw === null ? null : (raw.trim() || null)
  }

  if ('setupId' in body) {
    const raw = body.setupId
    if (raw !== null && (typeof raw !== 'number' || !Number.isInteger(raw))) {
      throw createError({ statusCode: 400, statusMessage: 'setupId must be an integer or null' })
    }
    updates.setupId = raw as number | null
  }

  if ('setupSnapshot' in body) {
    const raw = body.setupSnapshot
    if (raw !== null && (typeof raw !== 'object' || Array.isArray(raw))) {
      throw createError({ statusCode: 400, statusMessage: 'setupSnapshot must be an object or null' })
    }
    updates.setupSnapshot = raw as Record<string, unknown> | null
  }

  // If setupId was set without an explicit snapshot, auto-copy from the setup row.
  if ('setupId' in body && !('setupSnapshot' in body) && typeof updates.setupId === 'number') {
    const setup = (await db
      .select({ build: schema.setups.build, tune: schema.setups.tune })
      .from(schema.setups)
      .where(eq(schema.setups.id, updates.setupId))
      .limit(1))[0]

    if (!setup) {
      throw createError({ statusCode: 404, statusMessage: 'setup not found' })
    }
    updates.setupSnapshot = { build: setup.build, tune: setup.tune }
  }

  // Detaching a setup clears its snapshot too.
  if ('setupId' in body && updates.setupId === null && !('setupSnapshot' in body)) {
    updates.setupSnapshot = null
  }

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'no fields to update' })
  }

  const updated = await db
    .update(schema.sessions)
    .set(updates)
    .where(eq(schema.sessions.id, id))
    .returning()

  if (updated.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'session not found' })
  }
  return updated[0]!
})
