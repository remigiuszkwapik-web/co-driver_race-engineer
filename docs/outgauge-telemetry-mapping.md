# OutGauge telemetry mapping (BeamNG.drive / Live for Speed)

Maps the **OutGauge** protocol onto the canonical `Telemetry` model
(`server/utils/decode.ts`). Implemented in `server/adapters/outgauge.ts` as a
factory; `beamng` and `lfs` both use it (BeamNG natively, LFS as its originator).

## Transport

- **Protocol:** UDP, stateless. One fixed **92-byte** struct (96 with the
  optional trailing `ID`), little-endian.
- **BeamNG:** Options → Other → Protocols → OutGauge UDP, ip `127.0.0.1`,
  port **4444**.
- **LFS:** set `OutGauge Mode`/`IP`/`Port` in `cfg.txt`; point at our LFS port.
- **Default ports (ours):** BeamNG `4444`, LFS `30000` (distinct so both sockets
  bind; only one game runs at a time in practice).
- Discriminator: `buf.length >= 92`.

## OutGaugePack struct (source: LFS InSim reference)

| off | type | field | → `Telemetry` |
|----|----|----|----|
| 0 | u32 | Time (ms) | — (wall-clock instead; N/A in BeamNG) |
| 8 | u16 | Flags | — |
| 10 | u8 | Gear (R:0,N:1,1st:2…) | `gear` = Gear − 1 |
| 12 | f32 | Speed (m/s) | `speedKmh` ×3.6 |
| 16 | f32 | RPM | `rpm` |
| 20 | f32 | Turbo (BAR) | `boost` ×14.5037738 → PSI |
| 24 | f32 | EngTemp (C) | — (no canonical field) |
| 28 | f32 | Fuel (0–1) | `fuel` |
| 48 | f32 | Throttle (0–1) | `throttle` |
| 52 | f32 | Brake (0–1) | `brake` |
| 56 | f32 | Clutch (0–1) | `clutch` |

## What OutGauge does not carry (zero / null)

OutGauge is a **dashboard** protocol. No motion, no per-wheel physics, no lap
data, no steering. The following are zero/null:

- `rpmMax`, `rpmIdle`, `steer`, `handBrake`, `torque`, `power`.
- `position`, `velocity`, `acceleration`, `angularVelocity`, `yaw/pitch/roll`.
- all per-wheel: `suspension(Meters)`, `slipRatio`, `slipAngle`, `combinedSlip`,
  `tireTempC`, `wheelRotation`, `rumble`, `puddle`.
- all `lap.*`, `car.*`, `drivingLine`, `aiBrakeDifference`.

To fill motion/position for BeamNG, the separate **OutSim** stream would be
needed (future work).

## Open verification items

- **Turbo units.** Assumed gauge BAR → PSI (NA cars read ~0). If BeamNG reports
  *absolute* bar, NA cars would read ~14.5 psi — verify in-game.
- **isRaceOn.** No pause/state bit; reported `true` on every valid decode.
- **timestampMs.** BeamNG leaves `Time` N/A, so we stamp wall-clock at receive
  (live-only, like the SMS adapter).
