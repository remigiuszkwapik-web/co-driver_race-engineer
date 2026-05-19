/**
 * Pure helpers for the trace history buffer. Lives outside the composable so
 * unit tests can import them without pulling in Nuxt/Vue's auto-imports.
 */

export interface TraceSample {
  /** game-clock ms at capture */
  t: number
  throttle: number
  brake: number
  steer: number
  /** rad/s, body yaw rate (positive = nose right) */
  yawRate: number
}

/** 10 seconds @ 30 Hz of server fan-out. */
export const TRACE_BUFFER_SIZE = 300

/**
 * Push a sample into a fixed-size history. Mutates the array in place — the
 * caller's reactive ref then triggers re-renders. O(n) on overflow because of
 * shift(), but n=300 and we run at 30 Hz — negligible.
 */
export function pushSample(history: TraceSample[], sample: TraceSample, max = TRACE_BUFFER_SIZE): TraceSample[] {
  history.push(sample)
  while (history.length > max) history.shift()
  return history
}
