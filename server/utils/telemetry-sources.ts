import type { TelemetryAdapter } from '../adapters/types'

export interface TelemetrySource {
  port: number
  adapter: TelemetryAdapter
}

/**
 * The distinct UDP (port → adapter) pairs the listener binds — one socket each.
 * Adapters that share a port collapse to a single source (first wins): the
 * Horizon family (FH5/FH6/FM) shares port 5300 and an identical decoder, so it's
 * one socket regardless.
 *
 * Ports are fixed per adapter (the game's documented default). To move a port
 * that clashes on the host, remap it externally — Docker `-p host:container/udp`
 * — rather than reconfiguring the container.
 */
export function resolveSources(adapters: TelemetryAdapter[]): TelemetrySource[] {
  const byPort = new Map<number, TelemetrySource>()
  for (const adapter of adapters) {
    const port = adapter.transport.defaultPort
    if (!byPort.has(port)) byPort.set(port, { port, adapter })
  }
  return [...byPort.values()]
}
