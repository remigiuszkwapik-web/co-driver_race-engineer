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
}
