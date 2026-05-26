/**
 * Rolling coast-time % — server-side count of frames where the driver is
 * coasting through a corner (off both pedals while still turning),
 * computed over a sliding 30 s window and broadcast at ~5 Hz over the bus.
 *
 * Definition (verbatim from WISHLIST.md):
 *   throttle < 0.05 AND brake < 0.05 AND |steer| > 0.1
 *
 * The steer filter is what makes this a *measurement* and not just a
 * single-channel aggregate: it picks out "coasting through a corner"
 * specifically, vs. "lifted off everything on a straightaway" (which
 * the trace strip already shows directly via the throttle/brake lines
 * both sitting at zero).
 *
 * Architecture mirrors RollingTbPercent line-for-line. Duplication is
 * deliberate at two consumers — extract to a shared sliding-window
 * helper if a third lands.
 */

import type { Telemetry } from './decode'
import { forzaBus } from './forza-bus'

const WINDOW_MS = 30_000
/** Emit one measurement per N frames at 60 Hz fan-out (≈5 Hz). */
const EMIT_EVERY_N_FRAMES = 12
/** Backwards-jump threshold for clearing the window on race-to-race
 *  transitions: Forza's per-race clock resets to 0 between events. */
const CLOCK_RESET_GAP_MS = 1000

const THROTTLE_MAX = 0.05
const BRAKE_MAX = 0.05
const STEER_MIN = 0.1

interface WindowFrame {
  timestampMs: number
  throttle: number
  brake: number
  steer: number
}

export class RollingCoastTime {
  private window: WindowFrame[] = []
  private frameCounter = 0

  constructor() {
    forzaBus.on('telemetry', t => this.onTelemetry(t))
  }

  private onTelemetry(t: Telemetry): void {
    // Game paused / loading / pre-race UI → freeze the window.
    if (!t.isRaceOn) return

    const newT = t.timestampMs
    const last = this.window[this.window.length - 1]
    // New race / clock reset: drop the stale window and restart.
    if (last && newT < last.timestampMs - CLOCK_RESET_GAP_MS) {
      this.window = []
    }

    this.window.push({
      timestampMs: newT,
      throttle: t.throttle,
      brake: t.brake,
      steer: t.steer
    })

    // Drop frames older than WINDOW_MS off the front.
    const cutoff = newT - WINDOW_MS
    let drop = 0
    while (drop < this.window.length && this.window[drop]!.timestampMs < cutoff) drop++
    if (drop > 0) this.window.splice(0, drop)

    this.frameCounter++
    if (this.frameCounter % EMIT_EVERY_N_FRAMES !== 0) return

    let coastCount = 0
    for (let i = 0; i < this.window.length; i++) {
      const f = this.window[i]!
      if (f.throttle < THROTTLE_MAX && f.brake < BRAKE_MAX && Math.abs(f.steer) > STEER_MIN) {
        coastCount++
      }
    }
    const startMs = this.window[0]!.timestampMs
    const endMs = newT
    // Coast % is defined for any non-empty window; emit 0, not NaN, when
    // no frames qualify (window is non-empty by construction here since
    // we just pushed `t` above).
    const value = this.window.length > 0 ? coastCount / this.window.length : 0

    forzaBus.emit('measurement', {
      name: 'time_coast',
      value,
      startMs,
      endMs
    })
  }
}

export const rollingCoastTime = new RollingCoastTime()
