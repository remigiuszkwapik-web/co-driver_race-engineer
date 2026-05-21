import { eq } from 'drizzle-orm'
import { db, schema } from 'hub:db'

interface PatchBody {
  tuneLabel?: unknown
  buildId?: unknown
  buildSnapshot?: unknown
  tuneId?: unknown
  tuneSnapshot?: unknown
}

/**
 * Edit a session. Supports updating:
 * - tuneLabel — legacy free-text label (back-compat).
 * - buildId — attach a named build. If no explicit buildSnapshot is provided,
 *   server copies the build's current settings as the immutable snapshot.
 * - buildSnapshot — override the snapshot directly.
 * - tuneId — attach a named tune (Phase 1b — tunes table is currently
 *   empty in v1, so this is wired but not yet used by the UI). Snapshot
 *   auto-copies the tune's settings if not explicitly provided.
 * - tuneSnapshot — override directly.
 *
 * Setting any *Id to null detaches it AND clears its snapshot.
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

  if ('buildId' in body) {
    const raw = body.buildId
    if (raw !== null && (typeof raw !== 'number' || !Number.isInteger(raw))) {
      throw createError({ statusCode: 400, statusMessage: 'buildId must be an integer or null' })
    }
    updates.buildId = raw as number | null
  }

  if ('buildSnapshot' in body) {
    const raw = body.buildSnapshot
    if (raw !== null && (typeof raw !== 'object' || Array.isArray(raw))) {
      throw createError({ statusCode: 400, statusMessage: 'buildSnapshot must be an object or null' })
    }
    updates.buildSnapshot = raw as Record<string, unknown> | null
  }

  if ('tuneId' in body) {
    const raw = body.tuneId
    if (raw !== null && (typeof raw !== 'number' || !Number.isInteger(raw))) {
      throw createError({ statusCode: 400, statusMessage: 'tuneId must be an integer or null' })
    }
    updates.tuneId = raw as number | null
  }

  if ('tuneSnapshot' in body) {
    const raw = body.tuneSnapshot
    if (raw !== null && (typeof raw !== 'object' || Array.isArray(raw))) {
      throw createError({ statusCode: 400, statusMessage: 'tuneSnapshot must be an object or null' })
    }
    updates.tuneSnapshot = raw as Record<string, unknown> | null
  }

  // Auto-copy snapshots when the *Id is set without an explicit snapshot.
  if ('buildId' in body && !('buildSnapshot' in body) && typeof updates.buildId === 'number') {
    const build = (await db
      .select({ settings: schema.builds.settings })
      .from(schema.builds)
      .where(eq(schema.builds.id, updates.buildId))
      .limit(1))[0]
    if (!build) {
      throw createError({ statusCode: 404, statusMessage: 'build not found' })
    }
    updates.buildSnapshot = build.settings as Record<string, unknown>
  }
  if ('tuneId' in body && !('tuneSnapshot' in body) && typeof updates.tuneId === 'number') {
    const tune = (await db
      .select({ settings: schema.tunes.settings })
      .from(schema.tunes)
      .where(eq(schema.tunes.id, updates.tuneId))
      .limit(1))[0]
    if (!tune) {
      throw createError({ statusCode: 404, statusMessage: 'tune not found' })
    }
    updates.tuneSnapshot = tune.settings as Record<string, unknown>
  }

  // Detaching also clears the snapshot.
  if ('buildId' in body && updates.buildId === null && !('buildSnapshot' in body)) {
    updates.buildSnapshot = null
  }
  if ('tuneId' in body && updates.tuneId === null && !('tuneSnapshot' in body)) {
    updates.tuneSnapshot = null
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
