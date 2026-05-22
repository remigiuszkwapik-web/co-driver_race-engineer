import type { Telemetry } from '../../server/utils/decode'
import type { DebugFrame, RecordingState, TunePrompt } from '../../server/utils/forza-bus'
import { TRACE_BUFFER_SIZE, pushSample, type TraceSample } from '../utils/trace'

/**
 * Pause source for the live trace strip + DVR scrub.
 *  - 'live':  panels follow the latest telemetry frame; trace is rolling.
 *  - 'game':  Forza paused the race; trace freezes; user can scrub history.
 *  - 'user':  user hit PAUSE manually; sticky across a game-resume edge.
 */
type PauseSource = 'live' | 'user' | 'game'

interface ServerMessage {
  type: 'hello' | 'telemetry' | 'debug' | 'recording_state' | 'tune_prompt' | 'forza_status' | 'error'
  t?: Telemetry
  d?: DebugFrame
  message?: string
  // recording_state fields
  state?: 'idle' | 'recording'
  sessionId?: number
  eventId?: number
  carOrdinal?: number
  lapsCompleted?: number
  // tune_prompt fields
  previousPi?: number
  currentPi?: number
  // forza_status fields
  connected?: boolean
  lastPacketAt?: number | null
}

const _state = {
  telemetry: ref<Telemetry | null>(null),
  debug: ref<DebugFrame | null>(null),
  connected: ref(false),
  forzaConnected: ref(false),
  forzaLastPacketAt: ref<number | null>(null),
  hasReceivedFrame: ref(false),
  history: ref<TraceSample[]>([]),
  framesBuffer: ref<Telemetry[]>([]),
  pauseSource: ref<PauseSource>('live'),
  scrubIndex: ref<number | null>(null),
  recording: ref<RecordingState>({ state: 'idle' }),
  tunePrompt: ref<TunePrompt | null>(null),
  lastError: ref<string | null>(null),
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
    // We've lost ground truth about Forza — show as disconnected until the
    // server tells us otherwise on reconnect.
    _state.forzaConnected.value = false
    _state.ws = null
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

      // Drive pause-source transitions from the game's race state.
      // - live + race-off → upgrade to 'game' so panels freeze and DVR engages
      // - game + race-on  → drop back to 'live' and clear any scrub
      // - 'user' is sticky in both directions (manual pause survives game edges)
      if (_state.pauseSource.value === 'live' && !t.isRaceOn) {
        _state.pauseSource.value = 'game'
      } else if (_state.pauseSource.value === 'game' && t.isRaceOn) {
        _state.pauseSource.value = 'live'
        _state.scrubIndex.value = null
      }

      // Push to BOTH buffers while genuinely live so their indices stay
      // aligned. The instant the race goes off or the user pauses, both
      // freeze — otherwise paused-game frames (or noise during a manual
      // pause) would shift out the actual racing frames we want to scrub.
      if (t.isRaceOn && _state.pauseSource.value === 'live') {
        const buf = _state.framesBuffer.value
        buf.push(t)
        while (buf.length > TRACE_BUFFER_SIZE) buf.shift()
        pushSample(_state.history.value, {
          t: t.timestampMs,
          throttle: t.throttle,
          brake: t.brake,
          steer: t.steer,
          yawRate: t.angularVelocity.y,
          rpm: t.rpm,
          rpmMax: t.rpmMax,
          torqueNm: t.torque,
          powerKw: t.power / 1000
        })
      }
    } else if (msg.type === 'debug' && msg.d) {
      _state.debug.value = msg.d
    } else if (msg.type === 'recording_state' && msg.state) {
      if (msg.state === 'idle') {
        _state.recording.value = { state: 'idle' }
      } else if (
        msg.state === 'recording'
        && typeof msg.sessionId === 'number'
        && typeof msg.eventId === 'number'
        && typeof msg.carOrdinal === 'number'
        && typeof msg.lapsCompleted === 'number'
      ) {
        _state.recording.value = {
          state: 'recording',
          sessionId: msg.sessionId,
          eventId: msg.eventId,
          carOrdinal: msg.carOrdinal,
          lapsCompleted: msg.lapsCompleted
        }
      }
    } else if (
      msg.type === 'tune_prompt'
      && typeof msg.sessionId === 'number'
      && typeof msg.carOrdinal === 'number'
      && typeof msg.previousPi === 'number'
      && typeof msg.currentPi === 'number'
    ) {
      _state.tunePrompt.value = {
        sessionId: msg.sessionId,
        carOrdinal: msg.carOrdinal,
        previousPi: msg.previousPi,
        currentPi: msg.currentPi
      }
    } else if (msg.type === 'forza_status' && typeof msg.connected === 'boolean') {
      _state.forzaConnected.value = msg.connected
      _state.forzaLastPacketAt.value = msg.lastPacketAt ?? null
    } else if (msg.type === 'error' && msg.message) {
      _state.lastError.value = msg.message
    }
  }
}

function sendCommand(payload: Record<string, unknown>): boolean {
  const ws = _state.ws
  if (!ws || ws.readyState !== WebSocket.OPEN) return false
  ws.send(JSON.stringify(payload))
  return true
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

  const paused = computed<boolean>(() => _state.pauseSource.value !== 'live')

  const displayFrame = computed<Telemetry | null>(() => {
    const idx = _state.scrubIndex.value
    if (idx !== null) {
      return _state.framesBuffer.value[idx] ?? _state.telemetry.value
    }
    return _state.telemetry.value
  })

  function setScrub(i: number | null): void {
    if (i === null) {
      _state.scrubIndex.value = null
      return
    }
    const len = _state.framesBuffer.value.length
    if (len === 0) return
    _state.scrubIndex.value = Math.max(0, Math.min(len - 1, i))
    // Touching the trace strip implicitly pauses the live feed so the panels
    // don't fight the user's scrub. Game-paused stays game-paused.
    if (_state.pauseSource.value === 'live') {
      _state.pauseSource.value = 'user'
    }
  }

  function pauseManual(): void {
    if (_state.pauseSource.value === 'live') _state.pauseSource.value = 'user'
  }

  function resume(): void {
    _state.pauseSource.value = 'live'
    _state.scrubIndex.value = null
  }

  return {
    telemetry: _state.telemetry,
    debug: _state.debug,
    connected: _state.connected,
    forzaConnected: _state.forzaConnected,
    forzaLastPacketAt: _state.forzaLastPacketAt,
    hasReceivedFrame: _state.hasReceivedFrame,
    history: _state.history,
    framesBuffer: _state.framesBuffer,
    scrubIndex: _state.scrubIndex,
    pauseSource: _state.pauseSource,
    paused,
    displayFrame,
    setScrub,
    pauseManual,
    resume
  }
}

export function useRecording() {
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
    recording: _state.recording,
    tunePrompt: _state.tunePrompt,
    lastError: _state.lastError,
    connected: _state.connected,
    startRecording: (eventId: number, tuneLabel?: string | null): boolean => {
      _state.lastError.value = null
      return sendCommand({ type: 'start', eventId, tuneLabel: tuneLabel ?? null })
    },
    stopRecording: (): boolean => {
      _state.lastError.value = null
      return sendCommand({ type: 'stop' })
    },
    clearTunePrompt: (): void => {
      _state.tunePrompt.value = null
    },
    clearError: (): void => {
      _state.lastError.value = null
    }
  }
}
