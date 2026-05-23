# forza-data

Self-hosted telemetry and tuning tool for **Forza Horizon 6**. Listens for the game's UDP "Data Out" packets on your own machine and turns them into a per-corner instrument, a lap recorder, and a tune-aware workflow. No accounts, no cloud, no third-party telemetry.

> Measurement, not prescription. The tool shows you what the car actually did — you decide what to change.

## What it does

**Live telemetry**
- Per-corner readout: suspension travel, slip ratio + angle, tire temperatures banded cold / optimal / hot
- Bottoming indicator when normalized suspension travel saturates
- 10 s rolling input trace — throttle, brake, steering, yaw — drawn with uPlot at the full UDP packet rate
- Connection-status watchdog so you can see the moment the stream drops

**Session and lap analysis**
- Lap recorder with per-sector deltas against your personal best
- Persistent car identity, surfaced in a sticky session banner so the active car and recording state stay visible across laps
- Point-to-point buffering preserved across finish-line transitions

**Tune and upgrade workflow**
- Per-car "your data" panels next to every tune and upgrade page, so each adjustment is read against the telemetry the car actually produced
- Diagnose view that surfaces measurement-driven observations, not prescriptive scores
- A car library + event browser for organising sessions

## Install

### Option A — Docker (recommended)

You build the Nuxt bundle on your host, then ship it into a thin Node container.

```bash
git clone https://github.com/<you>/forza-data.git
cd forza-data

# 1. Build the Nuxt bundle (host needs bun)
bun install
bun run build:node

# 2. Build + run the container
docker compose up -d --build
```

Open <http://localhost:3000> and you'll see the "WAITING FOR TELEMETRY" screen until Forza starts sending.

Database migrations run automatically on container start. Session/lap data lives in a named volume (`forza-data`) and survives rebuilds.

To rebuild after pulling new code: re-run `bun run build:node && docker compose up -d --build`.

### Option B — Bare Node / Bun

```bash
git clone https://github.com/<you>/forza-data.git
cd forza-data
bun install
bun run dev          # development with HMR
# or
bun run build:node && node .output/server/index.mjs
```

## Configure Forza Horizon 6

In the game:

> Settings → HUD and Gameplay → Data Out

| Setting | Value |
|---|---|
| Data Out | **On** |
| Data Out IP | LAN IP of the machine running forza-data (or `127.0.0.1` if same PC) |
| Data Out Port | `5300` (or whatever you set `FORZA_PORT` to) |
| Data Out Packet Format | **Car Dash** |

The "Sled" format is a subset — it lacks tire temps, inputs, and lap data. Use **Car Dash**.

### Finding your server's LAN IP

```bash
# Linux
ip -4 addr show | awk '/inet / && !/127.0.0.1/ {print $2}'
# macOS
ipconfig getifaddr en0
# Windows
ipconfig
```

### Firewall

The listener binds UDP `5300` on `0.0.0.0` by default. If your OS firewall blocks it, allow inbound UDP `5300` from your LAN.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `FORZA_PORT` | `5300` | UDP port the server listens on |
| `FORZA_BIND` | `0.0.0.0` | Bind address (`127.0.0.1` for same-machine only) |
| `NITRO_PORT` | `3000` | Web UI port |
| `NITRO_HOST` | `0.0.0.0` | Web UI bind |

A starter `.env.example` is included; copy to `.env` to override defaults outside Docker.

## Stack

- Nuxt 4 + Nitro (server-side UDP listener, WebSocket fan-out to the browser)
- Tailwind 4 + Nuxt UI 4
- uPlot for the high-rate trace strip
- Drizzle + LibSQL for session/lap storage
- Bun for the dev/build toolchain, Node for the runtime container

## Development

| Command | Purpose |
|---|---|
| `bun dev` | Dev server with HMR + UDP listener |
| `bun run build` | Production build (default Nitro preset) |
| `bun run build:node` | Build for the Node runtime preset (what the Docker image consumes) |
| `bun run typecheck` | Type-check the project |
| `bun run lint` | Lint |
| `bun test:unit` | Decoder unit tests |
| `bun test:nuxt` | Component tests |
| `bun test:e2e` | Playwright E2E |

Package manager is **bun**. Do not use npm, yarn, or pnpm.

## Status

Early. The UI shape is stable, the recording pipeline is stable, the tune workflow is in active use. Expect rough edges and small breaking changes. Feedback and issue reports are welcome.

## License

[MIT](./LICENSE).
