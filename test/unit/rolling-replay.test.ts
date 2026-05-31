import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Telemetry } from '../../server/utils/decode'
import { forzaBus, type MeasurementEvent } from '../../server/utils/forza-bus'
import { RollingTbPercent } from '../../server/utils/rolling-tb-percent'
import { RollingCoastTime } from '../../server/utils/rolling-coast-time'
import { RollingPedalOverlap } from '../../server/utils/rolling-pedal-overlap'
import {
  rollingCoastSeries,
  rollingOverlapSeries,
  rollingTb,
  seriesUpTo
} from '../../app/utils/rolling-replay'

interface FrameInput {
  throttle?: number
  brake?: number
  steer?: number
  timestampMs: number
}

function makeFrame(opts: FrameInput): Telemetry {
  return {
    isRaceOn: true,
    timestampMs: opts.timestampMs,
    throttle: opts.throttle ?? 0,
    brake: opts.brake ?? 0,
    steer: opts.steer ?? 0,
    rpm: 0,
    rpmMax: 0,
    torque: 0,
    power: 0,
    speed: 0,
    angularVelocity: { x: 0, y: 0, z: 0 },
    accelLat: 0,
    accelLong: 0,
    lap: { number: 0, racePosition: 1, current: 0, last: 0, best: 0, raceTime: 0, distance: 0 },
    car: { ordinal: 12345, class: 800, pi: 745, drivetrain: 0, cylinders: 4 }
  } as unknown as Telemetry
}

/** Drive a frame array through a freshly-constructed server aggregator and
 *  collect the measurements it emits — the live `/live` reference series. */
function serverSeries(
  Ctor: new () => unknown,
  frames: Telemetry[]
): MeasurementEvent[] {
  const out: MeasurementEvent[] = []
  forzaBus.on('measurement', m => out.push(m))
  void new Ctor()
  for (const f of frames) forzaBus.emit('telemetry', f)
  return out
}

beforeEach(() => {
  forzaBus.removeAllListeners('telemetry')
  forzaBus.removeAllListeners('measurement')
})
afterEach(() => {
  forzaBus.removeAllListeners('telemetry')
  forzaBus.removeAllListeners('measurement')
})

// A varied 240-frame lap (~4 s at 60 Hz): a braking-into-corner phase, a
// coasting arc, and a left-foot-braking overlap stretch — enough to exercise
// all three measurements with non-trivial values.
function sampleLap(): Telemetry[] {
  const frames: Telemetry[] = []
  for (let i = 0; i < 240; i++) {
    let throttle = 0
    let brake = 0
    let steer = 0
    if (i < 80) {
      // Trail-brake: brake decays while steer ramps.
      const f = i / 80
      brake = 0.9 - f * 0.8
      steer = f * 0.5
    } else if (i < 160) {
      // Coast through the corner: off both pedals, still turning.
      steer = 0.4
    } else {
      // Left-foot braking: both pedals applied, light steer.
      throttle = 0.6
      brake = 0.3
      steer = 0.1
    }
    frames.push(makeFrame({ throttle, brake, steer, timestampMs: i * 16 }))
  }
  return frames
}

describe('rolling-replay', () => {
  describe('coast / overlap parity with the server aggregators', () => {
    it('coast series matches RollingCoastTime exactly (value + window bounds)', () => {
      const frames = sampleLap()
      const server = serverSeries(RollingCoastTime, frames)
      const client = rollingCoastSeries(frames)

      expect(client).toHaveLength(server.length)
      for (let i = 0; i < server.length; i++) {
        expect(client[i]!.value).toBeCloseTo(server[i]!.value, 10)
        expect(client[i]!.startMs).toBe(server[i]!.startMs)
        expect(client[i]!.endMs).toBe(server[i]!.endMs)
      }
    })

    it('overlap series matches RollingPedalOverlap exactly (value + window bounds)', () => {
      const frames = sampleLap()
      const server = serverSeries(RollingPedalOverlap, frames)
      const client = rollingOverlapSeries(frames)

      expect(client).toHaveLength(server.length)
      for (let i = 0; i < server.length; i++) {
        expect(client[i]!.value).toBeCloseTo(server[i]!.value, 10)
        expect(client[i]!.startMs).toBe(server[i]!.startMs)
        expect(client[i]!.endMs).toBe(server[i]!.endMs)
      }
    })
  })

  describe('TB% parity with RollingTbPercent', () => {
    it('matches the server on cadence, window bounds, and NaN positions', () => {
      const frames = sampleLap()
      const server = serverSeries(RollingTbPercent, frames)
      const { series } = rollingTb(frames)

      expect(series).toHaveLength(server.length)
      for (let i = 0; i < server.length; i++) {
        expect(series[i]!.startMs).toBe(server[i]!.startMs)
        expect(series[i]!.endMs).toBe(server[i]!.endMs)
        expect(Number.isNaN(series[i]!.value)).toBe(Number.isNaN(server[i]!.value))
      }
    })

    it('values match the server within the window-edge lookback tolerance', () => {
      // The only expected divergence: the server runs detectTrailBraking per
      // window, so frames within the 500 ms lookback of a window's left edge
      // can be flagged differently than the whole-lap pass here. Over a 30 s
      // window that's a handful of frames out of ~1800, so the ratio agrees
      // closely. The lap here is short (no window trimming yet), so they match
      // exactly — this guards against a larger drift creeping in.
      const frames = sampleLap()
      const server = serverSeries(RollingTbPercent, frames)
      const { series } = rollingTb(frames)
      for (let i = 0; i < server.length; i++) {
        if (Number.isNaN(server[i]!.value)) continue
        expect(series[i]!.value).toBeCloseTo(server[i]!.value, 6)
      }
    })

    it('bands carry game-clock timestamps inside the lap span', () => {
      const frames = sampleLap()
      const { bands } = rollingTb(frames)
      expect(bands.length).toBeGreaterThanOrEqual(1)
      for (const b of bands) {
        expect(b.endMs).toBeGreaterThan(b.startMs)
        expect(b.startMs).toBeGreaterThanOrEqual(0)
        expect(b.endMs).toBeLessThanOrEqual(239 * 16)
      }
    })

    it('returns empty series and bands for an empty lap', () => {
      expect(rollingTb([])).toEqual({ series: [], bands: [] })
      expect(rollingCoastSeries([])).toEqual([])
      expect(rollingOverlapSeries([])).toEqual([])
    })
  })

  describe('seriesUpTo', () => {
    const series = [
      { value: 0.1, startMs: 0, endMs: 100 },
      { value: 0.2, startMs: 0, endMs: 200 },
      { value: 0.3, startMs: 0, endMs: 300 }
    ]

    it('keeps readings whose endMs is at or before the playhead', () => {
      expect(seriesUpTo(series, 200)).toHaveLength(2)
      expect(seriesUpTo(series, 200).at(-1)!.value).toBe(0.2)
    })

    it('returns nothing before the first reading and everything after the last', () => {
      expect(seriesUpTo(series, 50)).toHaveLength(0)
      expect(seriesUpTo(series, 9999)).toHaveLength(3)
    })
  })
})
