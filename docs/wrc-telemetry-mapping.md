# EA Sports WRC telemetry mapping

Maps EA Sports WRC's configurable "custom UDP" feed onto the canonical
`Telemetry` model (`server/utils/decode.ts`). Implemented in
`server/adapters/wrc.ts`.

## Transport

- **Protocol:** UDP, stateless. One self-contained datagram = one full frame.
- **Packet:** the shipped read-only default **`wrc.json`** `session_update`
  structure — **237 bytes, packed (no alignment), little-endian**. The default
  has an empty header, so the stream starts at `packet_uid` (no 4CC magic).
- **Default port (ours):** `20789` (EA WRC's documented default).
- **Enable:** in the game's telemetry config, set the active packet structure to
  `wrc`, ip `127.0.0.1`, port `20789`. WRC also supports `custom1.json` and
  `wrc_experimental.json`; this adapter decodes the `wrc` layout specifically.

## Source of offsets

`readme/udp/wrc.json` (channel order) + `readme/channels.json` (channel types),
shipped by the game and mirrored at `vazhure/vAzhureRacingHub`. Byte offsets are
the cumulative packed sizes of each channel's type.

## Field map (byte → channel → `Telemetry`)

| byte | type | channel | `Telemetry` | transform |
|----|----|----|----|----|
| 8 | f32 | game_total_time | `timestampMs`, `lap.raceTime` | ×1000 |
| 37 | u8 | vehicle_gear_index | `gear` | see gear rule |
| 38/39 | u8 | gear neutral / reverse idx | (gear disambiguation) | — |
| 41 | f32 | vehicle_speed (m/s) | `speedKmh` | ×3.6 |
| 49–57 | f32 | position x/y/z | `position` | — |
| 61–69 | f32 | velocity x/y/z | `velocity` | — |
| 73–81 | f32 | acceleration x/y/z (m/s², world) | `acceleration` | project onto basis |
| 85–93 | f32 | left_direction | (accel/roll basis) | — |
| 97–105 | f32 | forward_direction | `yaw`,`pitch` | `atan2(x,z)`,`asin(y)` |
| 109–117 | f32 | up_direction | `roll` | `atan2(left.y, up.y)` |
| 121–133 | f32 | hub_position BL/BR/FL/FR (m) | `suspensionMeters` | reindex |
| 185 | f32 | engine_rpm_max | `rpmMax` | — (true rpm) |
| 189 | f32 | engine_rpm_idle | `rpmIdle` | — |
| 193 | f32 | engine_rpm_current | `rpm` | — |
| 197 | f32 | throttle | `throttle` | 0–1 |
| 201 | f32 | brake | `brake` | 0–1 |
| 205 | f32 | clutch | `clutch` | 0–1 |
| 209 | f32 | steering | `steer` | −1..1 |
| 213 | f32 | handbrake | `handBrake` | 0–1 |
| 217 | f32 | stage_current_time (s) | `lap.current` | — |
| 221 | **f64** | stage_current_distance (m) | `lap.distance` | — |
| 229 | **f64** | stage_length (m) | (unused) | — |

Wheel order is **[BL, BR, FL, FR]** → `{fl,fr,rl,rr}`.

**Gear rule:** `gear_index == reverse_index` → −1; otherwise
`gear_index − neutral_index` (neutral → 0, forward gears positive). This is
robust to whatever index base the game uses.

**Acceleration:** WRC reports world-space acceleration; we project it onto the
car's `left` / `up` / `forward` basis to get car-local components
`{x: lateral, y: vertical, z: longitudinal}`.

## Channels WRC's default packet does not provide (null / zero)

- `torque`, `boost`, `power` (= 0), `fuel`, `angularVelocity`.
- `slipRatio` / `slipAngle` / `combinedSlip` — no slip channels (only contact-
  patch forward speed, idx @153).
- `tireTempC` — only **brake** temperatures exist (@169).
- `wheelRotation` — contact-patch speed is linear m/s, not angular.
- `lap.number` / `last` / `best` / `racePosition` — stage-based; not in the
  default packet.

## Open verification items

- **Orientation signs.** yaw/pitch/roll derived from the basis vectors with
  assumed axes; signs unverified against in-game motion.
- **Acceleration sign.** Lateral uses `·left_direction` (left turn → positive);
  verify against the FH6 lateral-sign convention before trusting `GgDot`.
- **isRaceOn.** The default packet has no pause scope, so we report `true` on
  every valid decode (the game only streams during a live stage).
- **Packet discrimination.** No header magic; we accept any datagram ≥ 237 bytes
  on the port. The user must select the default `wrc` structure (not `custom1` /
  `wrc_experimental`, which have different layouts).
