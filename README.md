# forza-data

Self-hosted Forza Horizon tuning telemetry. UDP "Data Out" → Nitro WebSocket → SVG corner view. Local-first, no cloud, no accounts.

See [`DESIGN.md`](./DESIGN.md) for the full packet schema, architecture, and roadmap.

## What it does (v1)

Listens for Forza Horizon's UDP **Car Dash** packets, decodes them, and renders a tuning-focused dashboard:

- Per-corner panel (FL/FR/RL/RR) with suspension travel, slip ratio + angle, tire temperature (°C), rumble indicator
- Center panel with linear RPM bar (redline zone shaded), gear, km/h, throttle/brake/steer pills, boost
- **Bottoming flash** when normalized suspension > 0.95 — easiest way to spot springs/bumpstops trouble
- **Tire-temp heatmap** with cold/optimal/hot bands (80–95 °C optimal)
- **Debug panel** (press <kbd>D</kbd>) showing every decoded field plus the raw packet length and last 8 bytes in hex
- **PAUSED** overlay freezes the last live frame when you pause the game

## Setup

This is a Nuxt 4 + Nuxt UI 4 project. **bun only** — don't use npm/yarn/pnpm.

```bash
bun install
cp .env.example .env   # then edit if you want
bun dev
```

Open <http://localhost:3000> and you'll get the "WAITING FOR TELEMETRY" screen until Forza starts sending.

## Configure Forza

In the game:

> Settings → HUD and Gameplay → Data Out

| Setting | Value |
|---|---|
| Data Out | **On** |
| Data Out IP | The LAN IP of the machine running this app (e.g. `192.168.1.42`) |
| Data Out Port | `5300` (or whatever you set `FORZA_PORT` to) |
| Data Out Packet Format | **Car Dash** |

The "Sled" format is a subset — it lacks tire temps, inputs, and lap data. Use Car Dash.

### Finding your server's LAN IP

```bash
# Linux
ip -4 addr show | awk '/inet / && !/127.0.0.1/ {print $2}'

# macOS
ipconfig getifaddr en0
```

If the app is running on the same PC as Forza, use `127.0.0.1`.

### Firewall

The server binds UDP `5300` on `0.0.0.0` by default. If your firewall blocks it, allow inbound UDP on that port from your LAN. On Linux with `ufw`:

```bash
sudo ufw allow proto udp from 192.168.1.0/24 to any port 5300
```

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `FORZA_PORT` | `5300` | UDP port the server listens on |
| `FORZA_BIND` | `0.0.0.0` | Bind address. `127.0.0.1` for same-machine only |
| `NUXT_DEV_PORT` | `3000` | Web UI port |
| `NUXT_DEV_HOST` | `0.0.0.0` | Web UI bind |

## Commands

| | |
|---|---|
| `bun dev` | Dev server (HMR + UDP listener) |
| `bun run build` / `bun run preview` | Production build |
| `bun run typecheck` | Type-check |
| `bun run lint` | Lint |
| `bun test:unit` | Decoder unit tests |
| `bun test:nuxt` | Component tests |
| `bun test:e2e` | Playwright E2E |

## Roadmap

| | |
|---|---|
| **v1** (this build) | Corner + center panels, debug panel, PAUSED overlay |
| **v2** | Input + chassis trace strip (throttle/brake/steer/yaw over time) |
| **v3** | Lap recorder + live delta vs best, track map by position |
| **v4** | Tuning workbench: overlay two laps, bottoming-events list, tire-temp histograms |
| **v5** (optional) | Serial bridge to an RP2040/Arduino for a hardware shift light |

## Why self-hosted?

Forza's Data Out gives you the same telemetry that cloud services like the SimHub online stack consume — but it's a flat UDP broadcast. There's no reason for it to leave your network. Everything in this app runs on a box you own.

## License

See [`LICENSE`](./LICENSE).
