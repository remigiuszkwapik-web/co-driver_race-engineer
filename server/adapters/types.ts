import type { GameId } from '#shared/games'
import type { Telemetry } from '../utils/decode'

/**
 * Inbound adapter: maps one game's wire format onto the canonical `Telemetry`
 * model (the port). The UDP host hands raw datagrams to `decode`; everything
 * downstream (bus, recorder, rolling aggregators, WS, client) depends only on
 * `Telemetry`, never on a game's byte layout.
 *
 * Adding a game = implement this for it and register it in `./index.ts`.
 */
export interface TelemetryAdapter {
  id: GameId
  transport: {
    protocol: 'udp'
    /** Port the game's telemetry feed defaults to; the host may override via env. */
    defaultPort: number
  }
  /** Decode one datagram into the canonical model, or null when the packet
   *  doesn't match this adapter's format (wrong length, unknown variant). */
  decode(buf: Buffer): Telemetry | null
  /**
   * Optional outbound keep-alive. Some feeds (e.g. Gran Turismo 7) only start
   * streaming after the receiver sends a request packet to the game/console,
   * and stop unless it is re-sent periodically. When `host` resolves (the
   * adapter typically reads it from an env var), the listener sends `payload`
   * to `host:port` from the receive socket every `intervalMs`. Adapters without
   * a heartbeat (every other game) are unaffected.
   */
  heartbeat?: {
    /** Target host (the console/game IP). Undefined → the listener logs that it
     *  needs configuring and sends nothing. */
    host?: string
    /** UDP port on the target to send the keep-alive to. */
    port: number
    /** Resend interval in milliseconds. */
    intervalMs: number
    /** Bytes to send each tick. */
    payload: Buffer
  }
}
