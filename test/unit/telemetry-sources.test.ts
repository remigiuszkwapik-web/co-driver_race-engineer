import { describe, expect, it } from 'vitest'
import type { GameId } from '#shared/games'
import { resolveSources } from '../../server/utils/telemetry-sources'
import type { TelemetryAdapter } from '../../server/adapters/types'

const fake = (id: GameId, port: number): TelemetryAdapter => ({
  id,
  transport: { protocol: 'udp', defaultPort: port },
  decode: () => null
})

const fh6 = fake('fh6', 5300)
const fh5 = fake('fh5', 5300)
const f1 = fake('f1', 20777)

describe('resolveSources', () => {
  it('binds one socket per distinct port; shared-port adapters collapse (first wins)', () => {
    const sources = resolveSources([fh6, fh5, f1], null, 5300)
    expect(sources.map(s => s.port)).toEqual([5300, 20777])
    expect(sources.find(s => s.port === 5300)!.adapter).toBe(fh6)
    expect(sources.find(s => s.port === 20777)!.adapter).toBe(f1)
  })

  it('FORZA_PORT relocates only the overridable (Horizon) port', () => {
    const sources = resolveSources([fh6, fh5, f1], 6000, 5300)
    expect(sources.map(s => s.port).sort((a, b) => a - b)).toEqual([6000, 20777])
  })

  it('a FORZA_PORT equal to the default is a no-op', () => {
    const sources = resolveSources([fh6, fh5, f1], 5300, 5300)
    expect(sources.map(s => s.port)).toEqual([5300, 20777])
  })
})
