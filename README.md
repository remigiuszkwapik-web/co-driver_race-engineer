# co-driver

[![Source](https://img.shields.io/badge/source-github.com%2FOjansen%2Fco--driver-181717?logo=github)](https://github.com/Ojansen/co-driver) [![Docker Pulls](https://img.shields.io/docker/pulls/obedbj/co-driver)](https://hub.docker.com/r/obedbj/co-driver) [![License](https://img.shields.io/github/license/Ojansen/co-driver)](https://github.com/Ojansen/co-driver/blob/main/LICENSE)

Your own telemetry workspace for **Forza Horizon 6**. Runs on your laptop or a mini PC, reads the data Forza already broadcasts, and turns it into a second-screen dashboard, a hotlap timer, a dyno and a tune workbench. No accounts, no cloud, no leaderboards reading your laps.

> Measurement, not prescription. The tool shows you what the car actually did — you decide what to change.

## What you get

**A live dashboard for the second screen.**
Prop a phone or tablet next to the TV. Each corner of the car becomes its own instrument — suspension, tire temperatures, slip, damper motion. A 10‑second input trace shows throttle, brake, steering and yaw at the full game rate, with trail‑braking automatically highlighted. A live G‑G plot fades the last ~20 seconds so you can see how round your traction circle really is. Pause and scrub the last few seconds without leaving the page.

**A hotlap delta you'd recognise from real motorsport.**
Live delta to your session best, per‑sector PBs in green/purple, predicted and theoretical lap, and a track map that shows you exactly where the time is going.

**A dyno you actually understand.**
Plot your engine's power, torque and boost across the rev range. Pick units that match how you think — bar, psi or atm — and tune gear ratios against the powerband you actually have.

**A tune workbench built around your data.**
Springs, dampers, anti‑roll bars, tire pressures and brake bias each sit next to the telemetry that justifies the change. The auto‑baseline calculator gives you an FH6‑correct starting point, build‑aware so it adapts to your upgrades. Damper velocity histograms tell you whether your low‑speed and high‑speed bump/rebound are doing their job. Build and tune are kept as separate layers, so you never confuse "the car can't do this" with "the setup isn't there yet."

**A garage that remembers, and laps you can compare.**
Cars, builds, tunes and sessions stay organised across the workspace. Compare any two laps side by side — overlay routes, scrub through synchronised traces, read the apex‑speed table, the sector splits and the tune diff that explain the gap.

**Built‑in manuals.**
Every heavy view links to a short page that explains what to read and what to look for, so the tool teaches itself.

## Install

### Docker Hub (recommended)

Pull the prebuilt image. No clone, no toolchain.

```bash
docker run -d --name co-driver \
  -p 3000:3000 \
  -p 5300:5300/udp \
  -v co-driver:/app/data \
  --restart unless-stopped \
  obedbj/co-driver:latest
```

Open <http://localhost:3000>. You'll see "WAITING FOR TELEMETRY" until Forza starts sending. Migrations run automatically on first start; session/lap data lives in the named volume (`co-driver`) and survives container rebuilds.

Multi-arch — `linux/amd64` and `linux/arm64` both supported. Docker Hub serves the right manifest automatically.

### Build it yourself

```bash
git clone https://github.com/Ojansen/co-driver.git
cd co-driver
docker compose up -d --build
```

The Dockerfile is multi-stage: it installs and builds inside the container, so no host toolchain beyond Docker is required.

### Dev mode (contributors)

```bash
git clone https://github.com/Ojansen/co-driver.git
cd co-driver
bun install
bun run dev          # HMR
# or production-style on bare metal
bun run build:node && node .output/server/index.mjs
```

## Configure Forza Horizon 6

In the game:

> Settings → HUD and Gameplay → Data Out

| Setting | Value |
|---|---|
| Data Out | **On** |
| Data Out IP | LAN IP of the machine running co-driver (or `127.0.0.1` if same PC) |
| Data Out Port | `5300` (or whatever you set `FORZA_PORT` to) |

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

### Start order: server before game (or apply the ICMP fix)

If you start **Forza before co-driver is listening**, the stream can fail to connect and stay dead until you fully restart the game — no first packet ever arrives, even after the server comes up. This is not a bug in co-driver; it's a Windows networking quirk:

While nothing is bound to UDP `5300`, the server's OS answers each of Forza's packets with an **ICMP port-unreachable**. Windows delivers that to Forza's Data Out socket as a connection reset and wedges it permanently — a Data Out toggle won't revive it, only relaunching the game does.

Two ways to avoid it:

- **Simplest:** start co-driver before turning on Data Out (or keep it running as an always-on service). Once the listener is up first, there's no rejection to wedge the game.
- **Permanent fix (Linux server):** stop the host from sending that rejection, so Forza keeps streaming until co-driver binds and then attaches on the first packet:

  ```bash
  sudo iptables -A OUTPUT -p icmp --icmp-type port-unreachable -j DROP
  # persist across reboots (Debian/Ubuntu):
  sudo apt install -y iptables-persistent && sudo netfilter-persistent save
  ```

  The rule only matters during the no-listener window; it has no effect once co-driver is running.

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

### Publishing your own image

Forks can push to their own Docker Hub repo with one command:

```bash
make publish DOCKER_IMAGE=you/co-driver
```

The Makefile handles the buildx builder + QEMU emulator setup on first run, then does a multi-arch (`linux/amd64`, `linux/arm64`) build and push. `DOCKER_TAG` defaults to `latest`.

## Status

Early. The UI shape is stable, the recording pipeline is stable, the tune workflow is in active use. Expect rough edges and small breaking changes. Feedback and issue reports are welcome.

## License

[MIT](./LICENSE).
