# DiRT Rally 2.0 telemetry mapping

Maps the Codemasters "extradata" UDP feed onto the canonical `Telemetry` model
(`server/utils/decode.ts`). Implemented in `server/adapters/dirt2.ts`.

The same wire format is emitted by **DiRT Rally 1**, **DiRT Rally 2.0** and
**DiRT 4** — this adapter targets DiRT Rally 2.0 but decodes all three.

## Transport

- **Protocol:** UDP, stateless. One self-contained datagram = one full frame
  (like Forza's Data Out; unlike F1/SMS which spread a frame across packets).
- **Format:** `extradata="3"` → **264-byte** packet of 66 little-endian
  `float32`s. Byte offset = field index × 4.
- **Default port (ours):** `20778`. F1 already owns 20777 in our listener and
  `resolveSources` collapses shared ports, so DiRT gets its own. The port is
  freely configurable in-game.
- **Enable:** edit
  `…/My Games/DiRT Rally 2.0/hardwaresettings/hardware_settings_config.xml`:
  ```xml
  <udp enabled="true" extradata="3" ip="127.0.0.1" port="20778" delay="1" />
  ```

## Source of offsets

`ErlerPhilipp/dr2_logger` → `source/dirt_rally/udp_data.py` (the de-facto
community reference for the extradata=3 layout).

## Field map (index / byte → `Telemetry`)

| idx | byte | DiRT field | `Telemetry` | transform |
|----|----|----|----|----|
| 0 | 0 | run_time (s) | `timestampMs`, `lap.raceTime` | ×1000 for ms |
| 1 | 4 | lap_time (s) | `lap.current` | — |
| 2 | 8 | distance (m) | `lap.distance` | current-lap metres |
| 4–6 | 16–24 | pos x/y/z | `position` | — |
| 7 | 28 | speed (m/s) | `speedKmh` | ×3.6 |
| 8–10 | 32–40 | vel x/y/z | `velocity` | — |
| 11–13 | 44–52 | roll basis vec | `roll` | `asin(roll_y)` |
| 14–16 | 56–64 | pitch (forward) vec | `yaw`,`pitch` | `atan2(x,z)`, `asin(y)` |
| 17–20 | 68–80 | susp RL/RR/FL/FR | `suspensionMeters` | reindex → {fl,fr,rl,rr} |
| 29 | 116 | throttle | `throttle` | 0–1 |
| 30 | 120 | steering | `steer` | −1..1 |
| 31 | 124 | brakes | `brake` | 0–1 |
| 32 | 128 | clutch | `clutch` | 0–1 |
| 33 | 132 | gear | `gear` | round; N=0 |
| 34 | 136 | g_force_lat | `acceleration.x` | ×9.80665 |
| 35 | 140 | g_force_lon | `acceleration.z` | ×9.80665 |
| 36 | 144 | current_lap | `lap.number` | round; starts at 0 |
| 37 | 148 | rpm/10 | `rpm` | ×10 |
| 39 | 156 | car_pos | `lap.racePosition` | round |
| 45/46 | 180/184 | fuel in-tank / capacity | `fuel` | clamp(tank/capacity) |
| 62 | 248 | last_lap_time | `lap.last` | — |
| 63 | 252 | max_rpm/10 | `rpmMax` | ×10 |
| 64 | 256 | idle_rpm/10 | `rpmIdle` | ×10 |

Wheel order is **[RL, RR, FL, FR]**.

## Channels DiRT does not provide (null / zero)

- `torque`, `boost`, `power` — no engine-load channels (`power` = 0).
- `slipRatio` / `slipAngle` / `combinedSlip` — no slip channels. DiRT gives
  *linear* wheel speed (m/s, idx 25–28), not slip; deriving longitudinal slip
  from `(wheelSpeed − carSpeed)` is possible later but isn't true slip.
- `tireTempC` — only **brake** temperatures exist (idx 51–54), not tyre temps.
- `wheelRotation` — linear m/s, not angular rad/s, and no tyre radius to convert.
- `handBrake`, `drivingLine`, `aiBrakeDifference`, `angularVelocity`, car identity.

## Open verification items

- **Orientation signs.** yaw/pitch/roll are derived from the right/forward basis
  vectors with assumed axes (x=right, y=up, z=forward). Signs and the roll
  derivation are unverified against in-game motion — confirm before trusting
  `CarAttitude3D` for this game.
- **Reverse gear.** Encoding for reverse is unverified (neutral is 0); it may
  report as 0 and be indistinguishable from neutral.
- **isRaceOn.** DiRT exposes no pause flag and only streams during a live stage,
  so we report `true` on every valid decode.
