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
const pcars2 = fake('pcars2', 5606)

describe('resolveSources', () => {
  it('binds one socket per distinct port; shared-port adapters collapse (first wins)', () => {
    const sources = resolveSources([fh6, fh5, f1])
    expect(sources.map(s => s.port)).toEqual([5300, 20777])
    expect(sources.find(s => s.port === 5300)!.adapter).toBe(fh6)
    expect(sources.find(s => s.port === 20777)!.adapter).toBe(f1)
  })

  it('keeps every distinct port, one source each', () => {
    const sources = resolveSources([fh6, f1, pcars2])
    expect(sources.map(s => s.port).sort((a, b) => a - b)).toEqual([5300, 5606, 20777])
  })
})
