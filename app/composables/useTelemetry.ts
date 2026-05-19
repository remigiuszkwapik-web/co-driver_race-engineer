import type { Telemetry } from '../../server/utils/decode'
import type { DebugFrame } from '../../server/utils/forza-bus'
import { pushSample, type TraceSample } from '../utils/trace'

interface ServerMessage {
  type: 'hello' | 'telemetry' | 'debug'
  t?: Telemetry
  d?: DebugFrame
}

/**
 * Connects to /_ws, exposes reactive telemetry, debug frames, and connection state.
 * Single shared instance — multiple components calling this all see the same data.
 */
const _state = {
  telemetry: ref<Telemetry | null>(null),
  debug: ref<DebugFrame | null>(null),
  connected: ref(false),
  hasReceivedFrame: ref(false),
  history: ref<TraceSample[]>([]),
  tracePaused: ref(false),
  ws: null as WebSocket | null,
  refCount: 0
}

function connect() {
  if (_state.ws) return
  if (typeof window === 'undefined') return

  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/_ws`
  const ws = new WebSocket(url)
  _state.ws = ws

  ws.onopen = () => {
    _state.connected.value = true
  }
  ws.onclose = () => {
    _state.connected.value = false
    _state.ws = null
    // Try again after a short delay if anyone still wants telemetry.
    if (_state.refCount > 0) setTimeout(connect, 1000)
  }
  ws.onerror = () => {
    ws.close()
  }
  ws.onmessage = (e) => {
    let msg: ServerMessage
    try {
      msg = JSON.parse(e.data)
    } catch {
      return
    }
    if (msg.type === 'telemetry' && msg.t) {
      const t = msg.t
      _state.telemetry.value = t
      _state.hasReceivedFrame.value = true

      // Accumulate trace history only when racing and not paused.
      if (t.isRaceOn && !_state.tracePaused.value) {
        pushSample(_state.history.value, {
          t: t.timestampMs,
          throttle: t.throttle,
          brake: t.brake,
          steer: t.steer,
          yawRate: t.angularVelocity.y
        })
      }
    } else if (msg.type === 'debug' && msg.d) {
      _state.debug.value = msg.d
    }
  }
}

export function useTelemetry() {
  if (import.meta.client) {
    _state.refCount += 1
    connect()
    onBeforeUnmount(() => {
      _state.refCount -= 1
      if (_state.refCount === 0 && _state.ws) {
        _state.ws.close()
        _state.ws = null
      }
    })
  }

  return {
    telemetry: _state.telemetry,
    debug: _state.debug,
    connected: _state.connected,
    hasReceivedFrame: _state.hasReceivedFrame,
    history: _state.history,
    tracePaused: _state.tracePaused
  }
}
