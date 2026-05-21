import { sql } from 'drizzle-orm'
import { blob, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const eventType = ['rally', 'race', 'street_race', 'touge', 'cross_country', 'drag', 'freeroam'] as const
export type EventType = typeof eventType[number]

export const events = sqliteTable('events', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  type: text({ enum: eventType }).notNull(),
  createdAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
}, t => [
  uniqueIndex('events_name_type_unq').on(t.name, t.type)
])

export const cars = sqliteTable('cars', {
  id: integer().primaryKey({ autoIncrement: true }),
  ordinal: integer().notNull().unique(),
  class: integer().notNull(),
  displayName: text()
})

/**
 * setups holds a named, per-car structured Setup = build (Phase 1) + tune (Phase 1b).
 * The build/tune JSON shapes are owned by app/utils/setup-fields.ts.
 *
 * Sessions point at a setup via setupId and additionally carry an immutable
 * setupSnapshot of `{ build, tune }` captured at attachment time — so later
 * edits to the named setup don't retroactively rewrite historical session
 * measurements.
 */
export const setups = sqliteTable('setups', {
  id: integer().primaryKey({ autoIncrement: true }),
  carId: integer().notNull().references(() => cars.id),
  name: text().notNull(),
  build: text({ mode: 'json' }).notNull().default(sql`('{}')`),
  tune: text({ mode: 'json' }),
  createdAt: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
}, t => [
  uniqueIndex('setups_car_name_unq').on(t.carId, t.name)
])

export const sessions = sqliteTable('sessions', {
  id: integer().primaryKey({ autoIncrement: true }),
  eventId: integer().notNull().references(() => events.id),
  carId: integer().notNull().references(() => cars.id),
  tuneLabel: text(),
  piAtStart: integer().notNull(),
  startedAt: integer({ mode: 'timestamp' }).notNull(),
  endedAt: integer({ mode: 'timestamp' }),
  setupId: integer().references(() => setups.id),
  setupSnapshot: text({ mode: 'json' })
})

export const laps = sqliteTable('laps', {
  id: integer().primaryKey({ autoIncrement: true }),
  sessionId: integer().notNull().references(() => sessions.id),
  lapNumber: integer().notNull(),
  timeMs: integer().notNull(),
  framesBlob: blob({ mode: 'buffer' }).notNull()
})

export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert
export type Car = typeof cars.$inferSelect
export type NewCar = typeof cars.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type Lap = typeof laps.$inferSelect
export type NewLap = typeof laps.$inferInsert
export type Setup = typeof setups.$inferSelect
export type NewSetup = typeof setups.$inferInsert
