import type { TelemetryAdapter } from '../adapters/types'

export interface TelemetrySource {
  port: number
  adapter: TelemetryAdapter
}

/**
 * The distinct UDP (port → adapter) pairs the listener binds — one socket each.
 * Adapters that share a port collapse to a single source (first wins): the
 * Horizon family (FH5/FH6) shares port 5300 and an identical decoder, so it's
 * one socket regardless.
 *
 * `fixedPort` (from FORZA_PORT) relocates the `overridablePort` — the default
 * Horizon port — for back-compat with existing deployments; every other game
 * keeps its own default port.
 */
export function resolveSources(
  adapters: TelemetryAdapter[],
  fixedPort: number | null,
  overridablePort: number
): TelemetrySource[] {
  const byPort = new Map<number, TelemetrySource>()
  for (const adapter of adapters) {
    const base = adapter.transport.defaultPort
    const port = fixedPort != null && base === overridablePort ? fixedPort : base
    if (!byPort.has(port)) byPort.set(port, { port, adapter })
  }
  return [...byPort.values()]
}
