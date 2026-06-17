import dgram from 'node:dgram'
import { listAdapters } from '../adapters'
import type { TelemetryAdapter } from '../adapters'
import { resolveSources } from '../utils/telemetry-sources'
import { forzaBus, getForzaStatus, setForzaStatus, bumpForzaLastPacket } from '../utils/forza-bus'

// Connection watchdog: UDP is connectionless, so "connected" means "a packet
// arrived in the last STALE_MS" — across any source. This drives the UI badge.
const STALE_MS = 1000
const TICK_MS = 500

// ECONNRESET on the WebSocket upgrade socket bubbles up as an
// unhandledRejection when a browser tab is closed abruptly. It's harmless —
// the close handler detaches the bus listener regardless. Filter it so
// the logs stay readable.
let rejectionGuardInstalled = false
function installRejectionGuard() {
  if (rejectionGuardInstalled) return
  rejectionGuardInstalled = true
  process.on('unhandledRejection', (reason) => {
    const code = (reason as { code?: string } | null | undefined)?.code
    if (code === 'ECONNRESET' || code === 'EPIPE') return
    console.error('[telemetry] unhandled rejection', reason)
  })
}

// One UDP socket per game, each decoding with its own adapter and emitting onto
// the shared bus. Whichever game is running streams to its port; the others sit
// idle. In practice only one game streams at a time, so the bus carries a single
// stream and every downstream consumer (recorder, rolling aggregators, WS) is
// unchanged.
function bindSource(port: number, adapter: TelemetryAdapter): void {
  const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true })
  let warnedReject = false
  let firstPacketLogged = false

  sock.on('message', (buf, rinfo) => {
    const now = Date.now()
    if (!firstPacketLogged) {
      console.log(`[telemetry] first ${adapter.id} packet: ${buf.length} bytes from ${rinfo.address}:${rinfo.port}`)
      firstPacketLogged = true
    }
    if (!getForzaStatus().connected) {
      setForzaStatus({ connected: true, lastPacketAt: now })
    } else {
      bumpForzaLastPacket(now)
    }

    const t = adapter.decode(buf)
    if (!t) {
      if (!warnedReject) {
        console.warn(`[telemetry] ${buf.length}-byte packet on :${port} rejected by ${adapter.id} adapter — check the in-game output format`)
        warnedReject = true
      }
      return
    }
    forzaBus.emit('telemetry', t)
  })

  sock.on('error', err => console.error(`[telemetry] socket error on :${port}`, err))
  // Bind on all interfaces; remap externally (Docker `-p`) to relocate a port.
  sock.bind(port, '0.0.0.0', () => {
    const addr = sock.address()
    console.log(`[telemetry] listening udp://${addr.address}:${addr.port} as ${adapter.id} (~60 Hz)`)
    startHeartbeat(sock, adapter)
  })
}

// Some feeds (GT7) only stream after the receiver pings the console, re-sent
// periodically. Drive that keep-alive from the receive socket; without a
// configured host we can't send (the console IP isn't discoverable), so warn.
function startHeartbeat(sock: dgram.Socket, adapter: TelemetryAdapter): void {
  const hb = adapter.heartbeat
  if (!hb) return
  if (!hb.host) {
    console.warn(`[telemetry] ${adapter.id} needs a heartbeat target to start streaming — set its host env (e.g. GT7_HOST=<console-ip>)`)
    return
  }
  const send = (): void => {
    sock.send(hb.payload, hb.port, hb.host, (err) => {
      if (err) console.error(`[telemetry] ${adapter.id} heartbeat to ${hb.host}:${hb.port} failed`, err)
    })
  }
  send() // prime immediately so the stream starts
  const timer = setInterval(send, hb.intervalMs)
  timer.unref()
  sock.on('close', () => clearInterval(timer))
}

export default defineNitroPlugin(() => {
  installRejectionGuard()

  // Each adapter listens on its fixed default port (see resolveSources); relocate
  // a clashing port via Docker port-mapping, not config.
  for (const { port, adapter } of resolveSources(listAdapters())) {
    bindSource(port, adapter)
  }

  const watchdog = setInterval(() => {
    const s = getForzaStatus()
    const stale = s.lastPacketAt === null || (Date.now() - s.lastPacketAt) > STALE_MS
    if (s.connected && stale) {
      setForzaStatus({ connected: false, lastPacketAt: s.lastPacketAt })
    }
  }, TICK_MS)
  watchdog.unref()
})
