import { forzaBus, type DebugFrame } from '../utils/forza-bus'
import type { Telemetry } from '../utils/decode'

export default defineWebSocketHandler({
  open(peer) {
    peer.send(JSON.stringify({ type: 'hello' }))

    const onTelemetry = (t: Telemetry) => {
      peer.send(JSON.stringify({ type: 'telemetry', t }))
    }
    const onDebug = (d: DebugFrame) => {
      peer.send(JSON.stringify({ type: 'debug', d }))
    }

    forzaBus.on('telemetry', onTelemetry)
    forzaBus.on('debug', onDebug)

    // Store unsubscribers on the peer so close() can clean up.
    ;(peer as unknown as { _cleanup: () => void })._cleanup = () => {
      forzaBus.off('telemetry', onTelemetry)
      forzaBus.off('debug', onDebug)
    }
  },
  close(peer) {
    const cleanup = (peer as unknown as { _cleanup?: () => void })._cleanup
    if (cleanup) cleanup()
  }
})
