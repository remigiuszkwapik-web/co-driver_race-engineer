/**
 * Recording state machine for v3. See DESIGN.md §8.3.
 *
 * IDLE → RECORDING → IDLE, driven by start()/stop() calls.
 * Lives in the server so recording survives browser refresh and the UDP
 * stream + DB are both adjacent.
 *
 * Race-state gating: frames where `isRaceOn === false` are never buffered.
 * That filters loading screens, countdowns, post-finish UI, and any in-game
 * menu pause. For point-to-point event types (touge / rally / drag /
 * cross-country / freeroam) the buffer is additionally CLEARED when isRaceOn
 * goes false — so any frames captured before the actual event starts
 * (driving in freeroam to the event entrance, sitting in the lobby) are
 * tossed the moment the game shows a loading screen.
 *
 * Lap-flushing rule: the first LapNumber transition after start() is a
 * mid-lap join (the lap started before recording began) — discard. Every
 * later transition is a fully-captured lap; gzip the frame buffer and
 * insert a `laps` row with time_ms = LastLap from the new packet.
 *
 * stop() discards the in-progress buffer (partial lap), finalizes the
 * session, and emits a `tune_prompt` if PI shifted vs the car's previous
 * session.
 */

import { gzipSync } from 'node:zlib'
import { desc, eq } from 'drizzle-orm'
import { db, schema } from 'hub:db'
import type { EventType } from './../db/schema'
import type { Telemetry } from './decode'
import { forzaBus, type RecordingState, type TunePrompt } from './forza-bus'

/**
 * Event types where FH6 doesn't tick `LapNumber` during the run (point-to-point
 * or unbounded). For these, when the user clicks Stop without LapNumber ever
 * advancing, the whole Start→Stop window is flushed as one "lap" so the
 * session isn't empty. Documented in DESIGN.md §8.7.
 */
const POINT_TO_POINT_TYPES = new Set<EventType>([
  'touge',
  'rally',
  'cross_country',
  'drag',
  'freeroam'
])

interface RecordingContext {
  sessionId: number
  eventId: number
  eventType: EventType
  carId: number
  carOrdinal: number
  piAtStart: number
  previousPi: number | null
  startedAt: Date
  lastLapNumber: number
  lapInProgressFromStart: boolean
  buffer: Telemetry[]
  lapsCompleted: number
}

class Recorder {
  private latestFrame: Telemetry | null = null
  private ctx: RecordingContext | null = null

  constructor() {
    forzaBus.on('telemetry', t => this.onTelemetry(t))
  }

  getState(): RecordingState {
    if (!this.ctx) return { state: 'idle' }
    return {
      state: 'recording',
      sessionId: this.ctx.sessionId,
      eventId: this.ctx.eventId,
      carOrdinal: this.ctx.carOrdinal,
      lapsCompleted: this.ctx.lapsCompleted
    }
  }

  async start(eventId: number, tuneLabel: string | null = null): Promise<RecordingState> {
    if (this.ctx) return this.getState()
    const frame = this.latestFrame
    if (!frame) {
      throw new Error('No telemetry frame received yet — start the race in-game first')
    }

    const event = (await db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1))[0]
    if (!event) {
      throw new Error(`Unknown event id ${eventId}`)
    }
    const eventType = event.type as EventType

    const ordinal = frame.car.ordinal
    const existingCar = (await db.select().from(schema.cars).where(eq(schema.cars.ordinal, ordinal)).limit(1))[0]
    const car = existingCar ?? (await db.insert(schema.cars)
      .values({ ordinal, class: frame.car.class })
      .returning())[0]!

    const prevSession = (await db.select()
      .from(schema.sessions)
      .where(eq(schema.sessions.carId, car.id))
      .orderBy(desc(schema.sessions.startedAt))
      .limit(1))[0]

    const startedAt = new Date()
    const session = (await db.insert(schema.sessions)
      .values({
        eventId,
        carId: car.id,
        tuneLabel,
        piAtStart: frame.car.pi,
        startedAt
      })
      .returning())[0]!

    this.ctx = {
      sessionId: session.id,
      eventId,
      eventType,
      carId: car.id,
      carOrdinal: ordinal,
      piAtStart: frame.car.pi,
      previousPi: prevSession?.piAtStart ?? null,
      startedAt,
      lastLapNumber: frame.lap.number,
      lapInProgressFromStart: false,
      // Buffer starts empty — the first isRaceOn=true frame seeds it via
      // onTelemetry. Pre-event frames (driving to the event in freeroam,
      // lobby, countdown) never make it in.
      buffer: [],
      lapsCompleted: 0
    }

    const state = this.getState()
    forzaBus.emit('recording_state', state)
    return state
  }

  async stop(): Promise<RecordingState> {
    if (!this.ctx) return { state: 'idle' }
    const ctx = this.ctx
    this.ctx = null

    // Point-to-point fallback (§8.7): FH6 doesn't tick LapNumber on touge /
    // rally / drag / cross-country / freeroam runs, so a stop without any
    // LapNumber advance means the whole window is the run. Flush the buffer
    // as a single lap rather than discarding everything.
    if (
      ctx.lapsCompleted === 0
      && ctx.buffer.length >= 2
      && POINT_TO_POINT_TYPES.has(ctx.eventType)
    ) {
      const first = ctx.buffer[0]!
      const last = ctx.buffer[ctx.buffer.length - 1]!
      const timeMs = Math.max(1, last.timestampMs - first.timestampMs)
      const frames = ctx.buffer.slice()
      void this.flushLap(ctx.sessionId, 1, timeMs, frames)
      ctx.lapsCompleted = 1
    }

    const endedAt = new Date()
    await db.update(schema.sessions)
      .set({ endedAt })
      .where(eq(schema.sessions.id, ctx.sessionId))

    const idle: RecordingState = { state: 'idle' }
    forzaBus.emit('recording_state', idle)

    if (ctx.previousPi !== null && ctx.previousPi !== ctx.piAtStart) {
      const prompt: TunePrompt = {
        sessionId: ctx.sessionId,
        carOrdinal: ctx.carOrdinal,
        previousPi: ctx.previousPi,
        currentPi: ctx.piAtStart
      }
      forzaBus.emit('tune_prompt', prompt)
    }

    return idle
  }

  private onTelemetry(t: Telemetry): void {
    this.latestFrame = t
    const ctx = this.ctx
    if (!ctx) return

    // Skip frames while the race isn't on — these are loading screens,
    // countdowns, menus, post-finish UI, etc. They'd otherwise pollute the
    // buffer with zero-data frames and inflate the elapsed time.
    if (!t.isRaceOn) {
      // For point-to-point events the buffer == the run, and any frames
      // queued before the race actually starts are pre-event garbage
      // (driving from freeroam to the event, sitting in the lobby).
      // Clear them so the moment the race goes on we start fresh.
      if (POINT_TO_POINT_TYPES.has(ctx.eventType) && ctx.buffer.length > 0) {
        ctx.buffer = []
        ctx.lapInProgressFromStart = false
      }
      return
    }

    if (t.lap.number !== ctx.lastLapNumber) {
      if (ctx.lapInProgressFromStart && ctx.buffer.length > 0) {
        const completedLapNumber = ctx.lastLapNumber
        const lapTimeMs = Math.round(t.lap.last * 1000)
        const frames = ctx.buffer.slice()
        void this.flushLap(ctx.sessionId, completedLapNumber, lapTimeMs, frames)
        ctx.lapsCompleted += 1
      }
      ctx.lastLapNumber = t.lap.number
      ctx.buffer = []
      ctx.lapInProgressFromStart = true
      forzaBus.emit('recording_state', this.getState())
    }

    ctx.buffer.push(t)
  }

  private async flushLap(sessionId: number, lapNumber: number, timeMs: number, frames: Telemetry[]): Promise<void> {
    try {
      const blob = gzipSync(Buffer.from(JSON.stringify(frames), 'utf8'))
      await db.insert(schema.laps).values({
        sessionId,
        lapNumber,
        timeMs,
        framesBlob: blob
      })
    } catch (err) {
      console.error('[recorder] failed to flush lap', err)
    }
  }
}

export const recorder = new Recorder()
