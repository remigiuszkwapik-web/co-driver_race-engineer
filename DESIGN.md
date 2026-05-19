# Forza Telemetry & Car Debugger

A self-hosted, local-first tuning telemetry tool for Forza Horizon. Subscribes to the game's UDP "Data Out" stream, decodes the Car Dash packet, and renders live SVG views designed for tuning workflows — not for looking pretty on a stream overlay.

Runs entirely on the user's machine. No accounts, no cloud, no analytics. The game broadcasts UDP, Nuxt listens, the browser draws — that's the whole loop.

---

## 1. Stack

- **Nuxt 4** (server + client in one project)
- **Nitro** for the server — UDP listener lives in a Nitro plugin, telemetry is fanned out to clients over a Nitro WebSocket handler
- **Tailwind 4** for layout
- **Inline SVG** for all gauges, corner views, traces (art-in-code; no asset pipeline)
- **bun** as package manager + runtime for dev (matches Helios / Cozy Hub)
- **Playwright + Vitest** for tests (corner-view rendering snapshot, decoder unit tests)

No database in v1. Session capture (v2) writes per-lap JSON to disk under `./sessions/`.

---

## 2. The Forza "Data Out" stream

### How the game sends it

- UDP, fire-and-forget, no handshake.
- ~60 packets/sec while a race is on.
- Configured in-game: **Settings → HUD and Gameplay → Data Out** → set IP, port, format.
- Format must be **Car Dash** (the richer one). "Sled" is a subset and lacks tire temp, inputs, and lap info.

### Packet layout (Forza Horizon Car Dash, 324 bytes)

The packet is a contiguous binary struct, little-endian. The Horizon variant has a 12-byte gap between the Sled portion and the Dash extension — this is a known quirk inherited from how Horizon repackaged the Motorsport packet.

**Sled portion (offsets 0..231)** — shared with Motorsport's Sled format:

| Offset | Type | Field |
|---:|---|---|
| 0 | s32 | IsRaceOn (0 when paused / in menu — discard these packets) |
| 4 | u32 | TimestampMS |
| 8 | f32 | EngineMaxRpm |
| 12 | f32 | EngineIdleRpm |
| 16 | f32 | CurrentEngineRpm |
| 20..28 | f32×3 | Acceleration X/Y/Z (m/s²) |
| 32..40 | f32×3 | Velocity X/Y/Z |
| 44..52 | f32×3 | AngularVelocity X/Y/Z |
| 56 | f32 | Yaw |
| 60 | f32 | Pitch |
| 64 | f32 | Roll |
| 68..80 | f32×4 | **NormalizedSuspensionTravel** FL/FR/RL/RR (0..1, 1 = fully compressed) |
| 84..96 | f32×4 | **TireSlipRatio** FL/FR/RL/RR (0 = grip, >1 = wheelspin/lockup) |
| 100..112 | f32×4 | WheelRotationSpeed FL/FR/RL/RR (rad/s) |
| 116..128 | f32×4 | WheelOnRumbleStrip FL/FR/RL/RR (0/1) |
| 132..144 | f32×4 | WheelInPuddleDepth FL/FR/RL/RR |
| 148..160 | f32×4 | SurfaceRumble FL/FR/RL/RR |
| 164..176 | f32×4 | **TireSlipAngle** FL/FR/RL/RR (lateral slip) |
| 180..192 | f32×4 | **TireCombinedSlip** FL/FR/RL/RR (sqrt(ratio² + angle²)) |
| 196..208 | f32×4 | **SuspensionTravelMeters** FL/FR/RL/RR |
| 212 | s32 | CarOrdinal (the car's unique ID in Forza's catalog) |
| 216 | s32 | CarClass (0=D … 7=X) |
| 220 | s32 | CarPerformanceIndex |
| 224 | s32 | DrivetrainType (0=FWD, 1=RWD, 2=AWD) |
| 228 | s32 | NumCylinders |

**Horizon gap: offsets 232..243** — 12 bytes of unknown/padding. Skip them. Some community parsers mark this as "HUD type" or undocumented; nothing tuning-relevant lives here.

**Dash extension (offsets 244..323)** — Horizon-specific car/race state:

| Offset | Type | Field |
|---:|---|---|
| 244..252 | f32×3 | Position X/Y/Z (world coords) |
| 256 | f32 | **Speed** (m/s — multiply by 3.6 for km/h or 2.237 for mph) |
| 260 | f32 | Power (Watts) |
| 264 | f32 | Torque (Nm) |
| 268..280 | f32×4 | **TireTemp** FL/FR/RL/RR (°F — convert if you prefer °C) |
| 284 | f32 | Boost |
| 288 | f32 | Fuel (0..1) |
| 292 | f32 | DistanceTraveled (m) |
| 296 | f32 | BestLap (s) |
| 300 | f32 | LastLap (s) |
| 304 | f32 | CurrentLap (s) |
| 308 | f32 | CurrentRaceTime (s) |
| 312 | u16 | LapNumber |
| 314 | u8 | RacePosition |
| 315 | u8 | **Accel** (0..255 — throttle) |
| 316 | u8 | **Brake** (0..255) |
| 317 | u8 | Clutch (0..255) |
| 318 | u8 | HandBrake (0..255) |
| 319 | u8 | **Gear** (0=R, 1=N, 2..=1st…) |
| 320 | s8 | **Steer** (-127..127) |
| 321 | s8 | NormalizedDrivingLine |
| 322 | s8 | NormalizedAIBrakeDifference |
| 323 | — | unused / padding |

> ⚠️ FH5 may have shifted/added fields in late updates. The decoder should log packet length on first receipt; if it's not 324 bytes, dump the trailing bytes to console so we can map the rest.

### What matters for tuning, per signal

- **NormalizedSuspensionTravel** + **SuspensionTravelMeters**: bottoming out on bumps → springs too soft / bumpstops too short. Asymmetric L/R compression in steady-state cornering → ARB too stiff that axis.
- **TireSlipRatio**: longitudinal slip. >0.1 under power on driven wheels = wheelspin (diff/traction). >0.1 under braking = lockup (brake bias).
- **TireSlipAngle**: lateral slip. Front > rear = understeer. Rear > front = oversteer. Compare in mid-corner.
- **TireCombinedSlip**: the magnitude. Past ~1.0 you're off the friction circle.
- **TireTemp**: hot inner edge → too much camber. Hot outer → not enough. Front pair >> rear = understeer-bias setup. Target is roughly even temps across all four after a few laps.
- **Accel/Brake** as u8: input traces help separate driver from car.
- **Boost**: monitor turbo lag / overrun.

---

## 3. Architecture

```
┌──────────────────┐    UDP 5300    ┌──────────────────────┐
│  Forza Horizon   │ ─────────────► │  Nitro plugin         │
│  Data Out: ON    │  ~60 pkt/sec   │  (dgram socket)       │
└──────────────────┘                │   decodes packet      │
                                    │   emits on EventBus   │
                                    └──────────┬───────────┘
                                               │
                                  EventEmitter │
                                               ▼
                                    ┌──────────────────────┐
                                    │  Nitro WS handler     │
                                    │  /_ws                 │
                                    │  fans out to peers    │
                                    └──────────┬───────────┘
                                               │ ws frames (JSON or binary)
                                               ▼
                                    ┌──────────────────────┐
                                    │  Vue page             │
                                    │  reactive store       │
                                    │  SVG corner view      │
                                    └──────────────────────┘
```

### Components

- **`server/utils/forza-bus.ts`** — exports a singleton `EventEmitter`. Plugin emits, WS handler subscribes per peer.
- **`server/utils/decode.ts`** — single function `decodeCarDash(buf: Buffer): Telemetry`. Pure, well-tested.
- **`server/plugins/forza-listener.ts`** — binds the UDP socket, decodes, throttles to ~30 Hz, emits.
- **`server/routes/_ws.ts`** — `defineWebSocketHandler`. On `open`, register a listener on `forzaBus`; on `close`, remove it.
- **`pages/index.vue`** — the corner view.
- **`composables/useTelemetry.ts`** — opens the WebSocket, exposes a reactive `telemetry` ref + `connected` boolean.

### Throttling

The game blasts at 60 Hz. The browser doesn't need that. Two-stage:

1. Server throttles to ~30 Hz (every other packet) for the WS feed — halves bandwidth.
2. Client renders on `requestAnimationFrame`, reading the latest telemetry — decouples render from network jitter.

Even so, keep the option to **record** at full 60 Hz to a per-lap buffer (v2). Display Hz ≠ capture Hz.

---

## 4. First view: Suspension + Tire Corner

A top-down stylized car silhouette filling most of the screen. Each of the four corners has a panel attached, showing:

```
       ┌───────────────────────────┐    ┌───────────────────────────┐
       │ FRONT LEFT                │    │ FRONT RIGHT               │
       │ ┌─────────────┐           │    │           ┌─────────────┐ │
       │ │█████░░░░░░░░│ susp 0.42 │    │ susp 0.38 │█████░░░░░░░░│ │
       │ └─────────────┘           │    │           └─────────────┘ │
       │ slip R  0.06              │    │              slip R  0.04 │
       │ slip A  0.11              │    │              slip A  0.13 │
       │ temp    192 °F  ▓▓▓░     │    │     ▓▓▓▓   194 °F  temp   │
       │ ⊙ rumble                  │    │                  rumble ⊙ │
       └───────────────────────────┘    └───────────────────────────┘
                          ┌──────────────────┐
                          │   car silhouette │
                          │    (top-down)    │
                          │  speed: 142 km/h │
                          │  gear: 4         │
                          │  RPM: 6420 / 8000│
                          └──────────────────┘
       ┌───────────────────────────┐    ┌───────────────────────────┐
       │ REAR LEFT                 │    │ REAR RIGHT                │
       │   …same fields…           │    │   …same fields…           │
       └───────────────────────────┘    └───────────────────────────┘
```

### Visual encoding

- **Suspension bar**: horizontal SVG `<rect>` width = `normalizedTravel * 100%`. Color shifts green→yellow→red as it approaches 1.0. **Bottoming flash**: at travel > 0.95, the bar flashes for 200 ms. (Tuner's eye should be drawn to bottoming events.)
- **Slip ratio / angle**: numeric, with a small horizontal bar; positive=blue, negative=orange. Threshold marker at ±0.1.
- **Tire temp**: numeric °C (toggleable °F). Background color is a heatmap: cold blue → optimal green → hot red. Optimal target is roughly 80–95 °C — we'll let the user adjust this band per tire compound later.
- **Rumble indicator**: small dot, lights when `wheelOnRumbleStrip > 0`.
- **Center panel**: speed, gear, RPM bar (linear, not radial, so a glance reveals headroom against max).

### Why this view first

Suspension + tire corner data is what tuners stare at. One screen tells you:
- if the car bottoms out (rebound/bumpstop/spring rate),
- if the camber is wrong (temp gradient across the contact patch — well, Forza only gives one temp per tire, so we use L/R balance instead),
- if the diff is letting one rear wheel spin under power (slip ratio asymmetry),
- if you've got a brake-bias problem (slip ratio front-vs-rear under braking).

The "feels cool" RPM/boost dashboard is fun but doesn't change a setup decision.

---

## 5. Roadmap

### v1 — Corner view (this design doc)
- UDP listener, decoder, WS fan-out
- Single-page corner view
- Connection indicator + "waiting for telemetry" empty state

### v2 — Input + chassis traces
- Scrolling time-series strip below the corner view
- Lines: throttle (green), brake (red), steering (yellow), yaw rate (blue)
- 10-second sliding window
- Pause/scrub for post-corner analysis

### v3 — Lap recorder + delta
- Auto-detect lap boundaries via `LapNumber` change
- Capture every packet of a lap to `./sessions/<date>/<car>/<lap-id>.json`
- "Set best" button — afterwards, live delta line drawn vs best
- Track map: plot `(PositionX, PositionZ)` colored by current speed

### v4 — Tuning workbench
- Pick a captured lap and overlay traces from a second lap
- Compute per-sector deltas (sector boundaries by distance)
- "Bottoming events" list — every frame where `normalizedTravel > 0.95`, with the speed / steering at that frame
- Tire-temp histogram per lap

### v5 (maybe) — Hardware shift light
- Tiny serial bridge from the Nitro server to a USB-attached RP2040 or Arduino
- LEDs map to `currentRpm / engineMaxRpm`
- Stays optional; the screen view should never depend on hardware

---

## 6. Decisions (resolved 2026-05-19)

1. **Units**: **metric** — km/h + °C. Decoder converts speed from m/s and tire temp from °F internally; UI only ever shows the metric values.
2. **Forza port**: **5300 default**, overridable via `FORZA_PORT` env var. Lets the tool coexist with other telemetry consumers on the same LAN.
3. **Network setup**: **LAN** — Forza on PC/Xbox, Nuxt on a separate home server (`mainframe.bass-salak`). Server binds `0.0.0.0`; in-game Data Out IP = server's LAN IP; UDP 5300 must be open in the server's firewall. README documents how to find the LAN IP and add the firewall rule.
4. **Theme**: **dark only**. No toggle, no system auto-detect. Background `#09090b` (zinc-950), panels `#18181b/80` (zinc-900 with 80% alpha), text `#fafafa`, accents per the heatmap palette.
5. **Tire-temp band**: cold <80 °C, optimal 80–95 °C, hot >95 °C. Hardcoded as constants in `~/utils/tuning-constants.ts` for v1; settings panel arrives in v2 alongside the trace strip.
6. **Race-off behavior**: when `isRaceOn = 0`, **freeze the last live frame** and overlay a translucent `PAUSED` band across the screen. Lets you read post-crash state during the menu pause. Reconnection/initial-load shows a different "WAITING FOR TELEMETRY" empty state (no frozen frame yet).

---

## 7. Key code sketches

These are the load-bearing pieces. Not full files — just the shape of each.

### Decoder (`server/utils/decode.ts`)

```ts
export interface Telemetry {
  isRaceOn: boolean
  timestampMs: number
  rpm: number
  rpmMax: number
  rpmIdle: number
  speedKmh: number
  gear: number
  throttle: number   // 0..1
  brake: number      // 0..1
  steer: number      // -1..1
  power: number
  torque: number
  boost: number
  suspension: { fl: number; fr: number; rl: number; rr: number } // normalized 0..1
  slipRatio:  { fl: number; fr: number; rl: number; rr: number }
  slipAngle:  { fl: number; fr: number; rl: number; rr: number }
  tireTempC:  { fl: number; fr: number; rl: number; rr: number }
  rumble:     { fl: boolean; fr: boolean; rl: boolean; rr: boolean }
  lap: { number: number; current: number; last: number; best: number }
}

const fToC = (f: number) => (f - 32) * 5 / 9

export function decodeCarDash(buf: Buffer): Telemetry | null {
  if (buf.length < 324) return null

  const f32 = (o: number) => buf.readFloatLE(o)
  const u8  = (o: number) => buf.readUInt8(o)
  const s8  = (o: number) => buf.readInt8(o)
  const s32 = (o: number) => buf.readInt32LE(o)
  const u16 = (o: number) => buf.readUInt16LE(o)
  const u32 = (o: number) => buf.readUInt32LE(o)
  const quad = (o: number) => ({
    fl: f32(o), fr: f32(o + 4), rl: f32(o + 8), rr: f32(o + 12),
  })

  return {
    isRaceOn: s32(0) === 1,
    timestampMs: u32(4),
    rpmMax: f32(8),
    rpmIdle: f32(12),
    rpm: f32(16),
    suspension: quad(68),
    slipRatio:  quad(84),
    slipAngle:  quad(164),
    tireTempC: {
      fl: fToC(f32(268)), fr: fToC(f32(272)),
      rl: fToC(f32(276)), rr: fToC(f32(280)),
    },
    rumble: {
      fl: f32(116) > 0, fr: f32(120) > 0,
      rl: f32(124) > 0, rr: f32(128) > 0,
    },
    speedKmh: f32(256) * 3.6,
    power: f32(260),
    torque: f32(264),
    boost: f32(284),
    throttle: u8(315) / 255,
    brake:    u8(316) / 255,
    steer:    s8(320) / 127,
    gear:     u8(319),
    lap: {
      number:  u16(312),
      current: f32(304),
      last:    f32(300),
      best:    f32(296),
    },
  }
}
```

### Event bus (`server/utils/forza-bus.ts`)

```ts
import { EventEmitter } from 'node:events'
import type { Telemetry } from './decode'

class ForzaBus extends EventEmitter {
  declare emit: (event: 'telemetry', t: Telemetry) => boolean
  declare on:   (event: 'telemetry', listener: (t: Telemetry) => void) => this
  declare off:  (event: 'telemetry', listener: (t: Telemetry) => void) => this
}

export const forzaBus = new ForzaBus()
forzaBus.setMaxListeners(50) // raise ceiling for many tabs
```

### UDP listener plugin (`server/plugins/forza-listener.ts`)

```ts
import dgram from 'node:dgram'
import { decodeCarDash } from '../utils/decode'
import { forzaBus } from '../utils/forza-bus'

export default defineNitroPlugin(() => {
  const port = Number(process.env.FORZA_PORT ?? 5300)
  const bind = process.env.FORZA_BIND ?? '0.0.0.0'

  const sock = dgram.createSocket('udp4')

  // Throttle: send every other packet (~30 Hz).
  let frame = 0

  sock.on('message', (buf) => {
    const t = decodeCarDash(buf)
    if (!t || !t.isRaceOn) return
    if ((frame++ & 1) === 0) forzaBus.emit('telemetry', t)
  })

  sock.on('error', (err) => console.error('[forza] socket error', err))

  sock.bind(port, bind, () => {
    console.log(`[forza] listening on udp://${bind}:${port}`)
  })
})
```

### WS fan-out (`server/routes/_ws.ts`)

```ts
import { defineWebSocketHandler } from 'h3'
import { forzaBus } from '../utils/forza-bus'
import type { Telemetry } from '../utils/decode'

export default defineWebSocketHandler({
  open(peer) {
    const onTelemetry = (t: Telemetry) => peer.send(JSON.stringify(t))
    forzaBus.on('telemetry', onTelemetry)
    ;(peer as any)._onTelemetry = onTelemetry
  },
  close(peer) {
    const fn = (peer as any)._onTelemetry
    if (fn) forzaBus.off('telemetry', fn)
  },
})
```

### Nuxt config bits (`nuxt.config.ts`)

```ts
export default defineNuxtConfig({
  nitro: {
    experimental: { websocket: true },
  },
  // ...
})
```

### Client composable (`composables/useTelemetry.ts`)

```ts
import type { Telemetry } from '~/server/utils/decode'

export function useTelemetry() {
  const telemetry = ref<Telemetry | null>(null)
  const connected = ref(false)

  onMounted(() => {
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/_ws`
    const ws = new WebSocket(url)
    ws.onopen  = () => (connected.value = true)
    ws.onclose = () => (connected.value = false)
    ws.onmessage = (e) => (telemetry.value = JSON.parse(e.data))
    onBeforeUnmount(() => ws.close())
  })

  return { telemetry, connected }
}
```

### Corner panel (`components/CornerPanel.vue`) — shape only

```vue
<script setup lang="ts">
const props = defineProps<{
  label: string
  suspension: number  // 0..1
  slipRatio: number
  slipAngle: number
  tempC: number
  rumble: boolean
}>()

const bottoming = computed(() => props.suspension > 0.95)
const suspColor = computed(() => {
  if (props.suspension > 0.95) return '#ef4444'
  if (props.suspension > 0.80) return '#f59e0b'
  return '#22c55e'
})
const tempColor = computed(() => {
  const c = props.tempC
  if (c < 60)  return '#3b82f6'
  if (c < 80)  return '#14b8a6'
  if (c < 95)  return '#22c55e'
  if (c < 110) return '#f59e0b'
  return '#ef4444'
})
</script>

<template>
  <div class="rounded-lg bg-zinc-900/80 p-4 text-zinc-100 font-mono">
    <div class="text-xs uppercase tracking-wider text-zinc-400">{{ label }}</div>

    <svg viewBox="0 0 100 8" class="mt-2 w-full">
      <rect x="0" y="0" width="100" height="8" rx="2" fill="#27272a" />
      <rect x="0" y="0" :width="suspension * 100" height="8" rx="2" :fill="suspColor"
            :class="{ 'animate-pulse': bottoming }" />
    </svg>
    <div class="mt-1 text-xs">susp {{ suspension.toFixed(2) }}</div>

    <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
      <div>slip R<br><span class="text-base">{{ slipRatio.toFixed(2) }}</span></div>
      <div>slip A<br><span class="text-base">{{ slipAngle.toFixed(2) }}</span></div>
    </div>

    <div class="mt-3 flex items-center gap-2">
      <span class="inline-block h-3 w-3 rounded-sm" :style="{ background: tempColor }" />
      <span class="text-sm">{{ tempC.toFixed(0) }} °C</span>
      <span v-if="rumble" class="ml-auto text-xs text-amber-400">⊙ rumble</span>
    </div>
  </div>
</template>
```

---

## 8. What I won't build

- A Forza Motorsport mode. FM uses the same Sled but a slightly different Dash layout (no 12-byte gap). Easy to add later by branching the decoder on packet length.
- Cloud sync of sessions. Sessions stay on disk. If you want them off-box, that's `rsync`'s job.
- A login / multi-user mode. The whole thing lives on your network. If you want to lock the port down, that's a firewall rule, not a feature.
- "Driver coaching" overlays / lap suggestion AI. Out of scope; we want a tool, not a coach.
