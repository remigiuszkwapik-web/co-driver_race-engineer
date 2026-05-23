// Apply bundled Drizzle SQL migrations to the in-container sqlite DB.
// Idempotent; tracks applied files in a __migrations table.

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createClient } from '@libsql/client'

const dbUrl = process.env.FORZA_DB_URL ?? 'file:/app/data/db/sqlite.db'
const migrationsDir = process.env.FORZA_MIGRATIONS_DIR ?? '/app/server/db/migrations/sqlite'

const client = createClient({ url: dbUrl })

await client.execute(`CREATE TABLE IF NOT EXISTS __migrations (
  name TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
)`)

const applied = await client.execute('SELECT name FROM __migrations')
const seen = new Set(applied.rows.map(r => r.name))

const files = (await readdir(migrationsDir))
  .filter(f => f.endsWith('.sql'))
  .sort()

for (const file of files) {
  if (seen.has(file)) continue
  const raw = await readFile(join(migrationsDir, file), 'utf-8')
  const statements = raw.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)
  for (const stmt of statements) {
    await client.execute(stmt)
  }
  await client.execute({
    sql: 'INSERT INTO __migrations (name, applied_at) VALUES (?, ?)',
    args: [file, Date.now()]
  })
  console.log(`[migrate] applied ${file}`)
}

console.log(`[migrate] ${files.length} migrations on disk, ${files.length - seen.size} newly applied`)
client.close?.()
