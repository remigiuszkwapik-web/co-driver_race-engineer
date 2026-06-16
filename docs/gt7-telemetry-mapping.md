# Gran Turismo 7 telemetry mapping

Maps the GT7 / GT Sport encrypted UDP feed onto the canonical `Telemetry` model
(`server/utils/decode.ts`). Implemented in `server/adapters/gt7.ts` with the
Salsa20 cipher in `server/adapters/salsa20.ts`.

## Transport

- **Receive:** UDP port **33740**.
- **Heartbeat:** the console only streams after we send the byte `'A'` to
  **console:33739**, re-sent ~every second. Declared via the adapter
  `heartbeat` field and driven by the listener (`startHeartbeat`).
- **`GT7_HOST` env is required** — the console's IP. We must send first, so it
  can't be auto-discovered; without it the listener logs a warning and the
  stream never starts.
- **Packet:** the "A" packet — **296 bytes (0x128)**, Salsa20-encrypted,
  little-endian once decrypted. (Format "B" is larger; not requested.)
- **No PC agent** — unique among non-Forza sims: the console broadcasts directly.

## Decryption (source: Nenkai/PDTools, Bornhall/gt7telemetry)

- Key = `"Simulator Interface Packet GT7 ver 0.0"`[0:32].
- Seed `iv1 = u32le(@0x40)`; `iv2 = iv1 ^ 0xDEADBEAF`; nonce = `iv2(LE) ++ iv1(LE)`.
- Salsa20-decrypt the whole datagram; valid iff `u32le(@0) == 0x47375330`.

## Field map (decrypted offset → `Telemetry`)

| off | channel | `Telemetry` | transform |
|----|----|----|----|
| 0x04/08/0C | position x/y/z | `position` | — |
| 0x10/14/18 | velocity x/y/z (m/s) | `velocity` | — |
| 0x1C/20/24 | rot pitch/yaw/roll | `pitch`/`yaw`/`roll` | units unverified |
| 0x2C/30/34 | angular velocity (rad/s) | `angularVelocity` | — |
| 0x3C | rpm | `rpm` | — |
| 0x44/48 | fuel level / capacity | `fuel` | level/capacity; null if cap=0 (EV) |
| 0x4C | speed (m/s) | `speedKmh` | ×3.6 |
| 0x50 | boost (absolute ratio) | `boost` | (val−1)×14.5037738 → PSI |
| 0x60/64/68/6C | tyre temp FL/FR/RL/RR | `tireTempC` | — |
| 0x74 | current lap (i16) | `lap.number` | — |
| 0x78/7C | best / last lap (i32 ms) | `lap.best`/`last` | ÷1000; −1→0 |
| 0x80 | time on track (i32 ms) | `timestampMs`, `lap.raceTime` | raceTime ÷1000 |
| 0x84 | race position (i16) | `lap.racePosition` | — |
| 0x8A | rev limiter (u16) | `rpmMax` | — |
| 0x8E | flags | `isRaceOn`, `handBrake` | see below |
| 0x90 | gear (low nibble) | `gear` | 0 → −1 (reverse) |
| 0x91/92 | throttle / brake (u8) | `throttle`/`brake` | ÷255 |
| 0xA4/A8/AC/B0 | wheel angular speed (rad/s) | `wheelRotation` | — (native) |
| 0xC4/C8/CC/D0 | suspension height (m) | `suspensionMeters` | — |
| 0xF4 | clutch | `clutch` | — |
| 0x124 | car id (i32) | `car.ordinal` | — |

Wheel order is **[FL, FR, RL, RR]** — already our `Quad` order.

**Flags (@0x8E):** bit0 = on-track, bit1 = paused, bit6 = handbrake.
`isRaceOn = onTrack && !paused`; `handBrake = bit6 ? 1 : 0`.

## Channels GT7 does not send (null / zero)

- `torque`, `power`, `rpmIdle`, `steer` (no steering channel).
- `acceleration` — GT7 sends velocity only, no acceleration vector.
- `slipRatio` / `slipAngle` / `combinedSlip` — no slip channels (derivable from
  wheel angular speed × radius @0xB4 vs car speed, but not provided directly).
- `lap.current` (no current-lap-time field), `lap.distance`.

## Open verification items

- **Orientation units.** 0x1C/20/24 (pitch/yaw/roll) mapped directly; their
  range/units are unverified against in-game motion.
- **Gear.** Low nibble; `0` treated as reverse (per Bornhall). Whether GT7 has a
  distinct neutral value is unverified.
- **Boost.** Treated as absolute ratio → gauge bar (`val − 1`) → PSI; NA cars
  read ~0. Verify the absolute-vs-gauge assumption in-game.
- **timestampMs.** Uses "time on track" (ms), which may be in-session time of
  day rather than a monotonic session clock.
