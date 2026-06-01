import { describe, expect, it } from 'vitest'
import { LAP_CHANNELS } from '../../server/utils/lap-channels'
import { BUNDLE_FORMAT, BUNDLE_VERSION, toBundle, toCsv, toMotecCsv, type LapMeta } from '../../server/utils/lap-export'
import { encodeFrames, decodeFrames } from '../../server/utils/frames-codec'
import type { Telemetry, Quad } from '../../server/utils/decode'

function frame(i: number): Telemetry {
  const q = (b: number): Quad => ({ fl: b, fr: b + 0.1, rl: b + 0.2, rr: b + 0.3 })
  return {
    isRaceOn: true,
    timestampMs: 1000 + i * (1000 / 60), // t0 = 1000; Time column must rebase to 0
    rpm: 6000 + i, rpmMax: 8000, rpmIdle: 900,
    speedKmh: 140.25, power: 120000, torque: 320, boost: null,
    gear: 4, throttle: 0.5, brake: 0.25, clutch: 0, handBrake: 0, steer: -0.1,
    drivingLine: 5, aiBrakeDifference: -3,
    suspension: q(0.5), suspensionMeters: q(0.05), slipRatio: q(0.05), slipAngle: q(0.11), combinedSlip: q(0.11), tireTempC: q(85),
    wheelRotation: q(120), rumble: null, puddle: null,
    yaw: 0.12, pitch: 0.01, roll: 0.02,
    position: { x: 100 + i, y: 5, z: 200 + i },
    velocity: { x: 38, y: 0, z: 1 },
    acceleration: { x: 2, y: 0.1, z: 9.8 },
    angularVelocity: { x: 0, y: 0.27, z: 0 },
    car: { ordinal: 1234, class: 5, pi: 800, drivetrain: 2, cylinders: 8 },
    lap: { number: 1, racePosition: 1, current: i * 0.016, last: 0, best: 0, raceTime: i * 0.016, distance: i * 0.6 },
    fuel: 0.95, rawLength: 324
  }
}

const meta: LapMeta = {
  event: { name: 'Goliath', type: 'cross_country' },
  car: { ordinal: 1234, class: 5, displayName: 'Test Car' },
  build: { name: 'S2', settings: { tires: 'race' } },
  tune: { name: 'baseline', settings: { rear: 12 } },
  session: {
    tuneLabel: 'baseline', piAtStart: 800,
    startedAt: '2026-06-01T12:30:45.000Z', endedAt: null,
    buildSnapshot: null, tuneSnapshot: null
  },
  lap: { lapNumber: 2, timeMs: 91234 }
}

const frames = Array.from({ length: 5 }, (_, i) => frame(i))
const t0 = frames[0]!.timestampMs

describe('lap-channels', () => {
  it('Time channel is lap-relative seconds', () => {
    const time = LAP_CHANNELS[0]!
    expect(time.name).toBe('Time')
    expect(time.get(frames[0]!, t0)).toBe(0)
    expect(time.get(frames[2]!, t0)).toBeCloseTo(2 / 60, 6)
  })

  it('scales pedals 0..1 → 0..100 %', () => {
    const throttle = LAP_CHANNELS.find(c => c.name === 'Throttle')!
    expect(throttle.unit).toBe('%')
    expect(throttle.get(frames[0]!, t0)).toBe(50)
  })

  it('expands quads to four corner columns', () => {
    const names = LAP_CHANNELS.map(c => c.name)
    expect(names).toEqual(expect.arrayContaining(['Susp FL', 'Susp FR', 'Susp RL', 'Susp RR']))
  })
})

describe('toCsv', () => {
  it('headers carry name + unit and one data row per frame', () => {
    const lines = toCsv(frames, t0).trimEnd().split('\r\n')
    expect(lines[0]).toContain('Time (s)')
    expect(lines[0]).toContain('Throttle (%)')
    expect(lines).toHaveLength(frames.length + 1) // header + N rows
    expect(lines[1]!.split(',')[0]).toBe('0') // first frame Time = 0
  })

  it('renders absent channels (boost) as empty fields', () => {
    const header = toCsv(frames, t0).split('\r\n')[0]!.split(',')
    const boostCol = header.findIndex(h => h.startsWith('Boost'))
    const firstRow = toCsv(frames, t0).split('\r\n')[1]!.split(',')
    expect(firstRow[boostCol]).toBe('')
  })
})

describe('toMotecCsv', () => {
  const out = toMotecCsv(frames, t0, meta)

  it('opens with the MoTeC format marker and metadata block', () => {
    expect(out).toContain('"Format","MoTeC CSV File"')
    expect(out).toContain('"Venue","Goliath"')
    expect(out).toContain('"Sample Rate","60"')
  })

  it('quotes every field on every non-empty line', () => {
    const quotedLine = /^"([^"]|"")*"(,"([^"]|"")*")*$/
    for (const line of out.split('\r\n')) {
      if (line === '') continue
      expect(line).toMatch(quotedLine)
    }
  })
})

describe('toBundle', () => {
  it('round-trips the frames blob byte-for-byte (lossless, no re-encode)', () => {
    const blob = encodeFrames(frames)
    const bundle = toBundle(meta, blob.toString('base64'))

    expect(bundle.format).toBe(BUNDLE_FORMAT)
    expect(bundle.version).toBe(BUNDLE_VERSION)

    const lap = bundle.lap as { framesB64: string, lapNumber: number, timeMs: number }
    expect(lap.lapNumber).toBe(2)
    const back = Buffer.from(lap.framesB64, 'base64')
    expect(back.equals(blob)).toBe(true)
    expect(decodeFrames(back)).toEqual(decodeFrames(blob))
  })
})
