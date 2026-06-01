# SMS UDP (Project CARS 2 / AMS2) → `Telemetry` data-model diff

Working note for the SMS UDP adapter (issue #17, reused by AMS2 #18). Compares the Madness-engine
"SMS UDP" feed against our canonical `Telemetry` (`server/utils/decode.ts`) so the mapping, unit
conversions, multi-packet assembly, and model changes are settled **before** writing
`server/adapters/sms-udp.ts`.

Wire format reference: `SMS_UDP_Definitions.hpp` (saildeep/pcars2-udp), `#pragma pack(1)`. Treat
items marked **(verify)** as needing a live-capture confirmation. Transport: UDP **broadcast on
port 5606**; in-game set *UDP Protocol Version = Project CARS 2*.

---

## 1. Structural shape: multi-packet, viewed-participant

Like F1 (and unlike Forza's single packet), one logical frame is spread across packet types, each
carrying a 12-byte `PacketBase` header. The dispatch key is **`mPacketType` (u8 @ offset 10)**:

| type | Packet | Size | Carries (for us) |
|---|---|---|---|
| 0 `eCarPhysics` | `sTelemetryData` | 556 | engine, inputs, speed, orientation, velocity/accel, tyres, suspension, fuel, turbo — **emit trigger** |
| 1 `eRaceDefinition` | `sRaceData` | 308 | track length, world-fastest times (optional) |
| 3 `eTimings` | `sTimingsData` | 1059 | per-participant lap number, position, current lap time + distance |
| 4 `eGameState` | `sGameStateData` | 24 | game/session state → `isRaceOn` |
| 7 `eTimeStats` | `sTimeStatsData` | 1040 | per-participant **last + fastest** lap time |
| 8 `eParticipantVehicleNames` | — | 1164 | car name/class strings (optional, later) |

**Adapter is stateful** (mirror the F1 adapter): fold the latest Timings / TimeStats / GameState
into state, emit a merged `Telemetry` on the **Car Physics** packet (type 0). The player is
`sTelemetryData.sViewedParticipantIndex` (s8 @12) — use it to index the per-participant arrays in
the Timings/TimeStats packets.

---

## 2. Wheel order — no reindex (nice)

SMS tyre arrays are `[FL, FR, RL, RR]` (indices 0..3), which is exactly our `Quad {fl,fr,rl,rr}`.
So per-wheel reads map straight through — no reindexing like F1's `[RL,RR,FL,FR]`.

---

## 3. Field-by-field mapping

`Telemetry` ← SMS source (`Packet.field @offset`). All telemetry offsets are within `sTelemetryData`
unless a packet is named. "—" = no source.

### State / engine
| `Telemetry` | SMS source | Conversion / note |
|---|---|---|
| `isRaceOn` | GameState `mGameState @14` | `(mGameState & 0x7) == 2` (in-game playing); default true until seen |
| `timestampMs` | — | **No game-clock field.** Synthesize from a monotonic wall clock at decode (live-only; PCARS2 isn't recorded — `tuning:false`). (verify acceptable) |
| `rpm` | `sRpm` u16 @40 | direct |
| `rpmMax` | `sMaxRpm` u16 @42 | direct |
| `rpmIdle` | — | no field → `0` |
| `speedKmh` | `sSpeed` f32 @36 (m/s) | `× 3.6` |
| `power` | derived: `sEngineTorque @364 × sEngineSpeed @360` | **No direct power.** Derive `P = τ·ω` (W) if `sEngineSpeed` is rad/s. (verify units) |
| `torque` | `sEngineTorque` f32 @364 (Nm) | direct |
| `boost` | `sTurboBoostPressure` f32 @538 | units **(verify** — vs our PSI convention); NA cars ≈ 0 |

### Inputs
| `Telemetry` | SMS source | Conversion |
|---|---|---|
| `gear` | `sGearNumGears` u8 @45 | `g = field & 0x0F`; `g == 15 ? -1 (reverse) : g` (0 = neutral) |
| `throttle` | `sThrottle` u8 @30 | `/255` |
| `brake` | `sBrake` u8 @29 | `/255` |
| `clutch` | `sClutch` u8 @31 | `/255` |
| `handBrake` | `sHandBrake` u8 @370 | `/255` |
| `steer` | `sSteering` s8 @44 | `/127` |
| `drivingLine`, `aiBrakeDifference` | — | Forza-only → `null` |

### Per-wheel (`[FL,FR,RL,RR]` → `{fl,fr,rl,rr}` directly)
| `Telemetry` | SMS source | Conversion / note |
|---|---|---|
| `suspension` (0..1) | — | no normalized channel → `0` quad |
| `suspensionMeters` | `sSuspensionTravel[4]` f32 @312 | meters (verify sign/scale) |
| `slipRatio` | — | **SMS UDP telemetry has no slip channel** → `0` quad |
| `slipAngle` | — | → `0` quad |
| `combinedSlip` | — | → `0` quad |
| `tireTempC` | `sTyreTemp[4]` u8 @176 | already °C |
| `wheelRotation` | `sTyreRPS[4]` f32 @160 (rev/s) | `× 2π` → rad/s (verify) |
| `rumble`, `puddle` | — | → `null` |

### Orientation / motion
| `Telemetry` | SMS source | Conversion / note |
|---|---|---|
| `yaw` / `pitch` / `roll` | `sOrientation[3]` f32 @52 | order assumed `[heading, pitch, bank]` → yaw/pitch/roll (verify) |
| `position` | `sFullPosition[3]` f32 @542 | full-precision world position |
| `velocity` | `sWorldVelocity[3]` f32 @76 | direct |
| `acceleration` | `sLocalAcceleration[3]` f32 @100 | car-local m/s² (closest to Forza) |
| `angularVelocity` | `sAngularVelocity[3]` f32 @88 | direct |

### Car identity
| `Telemetry.car` | SMS source | Note |
|---|---|---|
| `ordinal/class/pi/drivetrain/cylinders` | — | no numeric ids → `0` sentinels. Name/class are strings in `eParticipantVehicleNames` (later) |

### Lap / race (from Timings @ `33 + viewedIndex*32`, TimeStats @ `16 + viewedIndex*32`)
| `Telemetry.lap` | SMS source | Conversion / note |
|---|---|---|
| `number` | Timings `sCurrentLap` u8 (+21) | direct |
| `racePosition` | Timings `sRacePosition` u8 (+14) | `& 0x7F` (top bit = active flag) |
| `current` | Timings `sCurrentTime` f32 (+22) | seconds |
| `last` | TimeStats `sLastLapTime` f32 (+4) | seconds |
| `best` | TimeStats `sFastestLapTime` f32 (+0) | seconds |
| `raceTime` | — | no elapsed-time field (`sEventTimeRemaining` is remaining) → `0` (verify) |
| `distance` | Timings `sCurrentLapDistance` u16 (+12) | **per-lap** meters (resets each lap) — note: FH6's `lap.distance` is *cumulative* (`project_fh6_lap_distance_cumulative`); SMS is already lap-relative |

### Misc
| `Telemetry` | SMS source | Conversion |
|---|---|---|
| `fuel` | `sFuelLevel` f32 @32 | already 0..1 |
| `rawLength` | — | triggering packet length |

---

## 4. What SMS gives that we don't model (ignore for v1)

Per-tyre tread/layer/carcass/rim/internal-air temps + left/center/right (we take the single
`sTyreTemp`), brake temps, tyre/brake/suspension damage, tyre wear, ride height, air pressure
(tyre), oil/water temp+pressure, aero/engine damage, wings, terrain/tyre flags, odometer,
brake bias, crash state. None block the adapter.

## 5. `Telemetry` model — nullability

No new flips required. The fields SMS can't provide are already handled:
- `torque` → provided (`sEngineTorque`); `boost` → provided (`sTurboBoostPressure`). (Both already
  `number | null` from the F1 work; here they're non-null.)
- `power` → derived (`τ·ω`), stays `number`.
- `slipRatio/slipAngle/combinedSlip/suspension` → `0` quads (non-nullable `Quad`; absent, not "missing").
- `rpmIdle`, `lap.raceTime`, `car.*` → `0` sentinels.
- `drivingLine`, `aiBrakeDifference`, `rumble`, `puddle` → already nullable → `null`.

## 6. Open decisions (resolve before coding)

1. **Power**: derive `sEngineTorque × sEngineSpeed` (assumes `sEngineSpeed` is rad/s → Watts), or
   leave `0`? *Recommend derive* — SMS has the components and `power` is non-nullable.
2. **`timestampMs`**: synthesize from a monotonic wall clock (live-only). *Recommend yes* — no game
   clock in the feed, PCARS2 isn't recorded.
3. **`lap.distance`**: keep SMS's per-lap distance as-is (it's already lap-relative). Document the
   semantic difference vs FH6's cumulative distance.
4. **Unit verifications** (live capture): `sTurboBoostPressure` units, `sEngineSpeed` rad/s,
   `sTyreRPS` rev/s, `sOrientation` axis order, `sSuspensionTravel` sign/scale.
5. **Packet dispatch**: branch on `mPacketType @10` (canonical). Lengths (556/1059/1040/24/308) are a
   secondary sanity check.

## 7. Plan

- Add `'pcars2'` to `GameId` + `shared/games.ts` (telemetry: true, **tuning: false** — Forza-only stack).
- `server/adapters/sms-udp.ts`: stateful multi-packet decoder (Car Physics emit trigger; fold
  Timings/TimeStats/GameState), `transport.defaultPort = 5606`. Exported so AMS2 (#18) reuses it.
- Register in `server/adapters/index.ts`. Under the multi-port listener this binds a third socket
  (5606) alongside Forza (5300) and F1 (20777).
- Unit test with synthetic packets (`test/unit/sms-udp.test.ts`).

## 8. Coverage summary

Maps cleanly: rpm/max, speed, all inputs, steer, gear, tyre temp, orientation, position, velocity,
angular velocity, fuel, torque, boost, lap number/position/current/last/best/distance. Derived:
power (`τ·ω`), wheelRotation (rev/s→rad/s). **Missing entirely**: slip (ratio/angle — no SMS UDP
channel), normalized suspension, rpmIdle, car PI/ordinal/class, drivingLine, aiBrakeDifference,
rumble, puddle, raceTime, game-clock timestamp.
