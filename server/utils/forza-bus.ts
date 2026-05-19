import { EventEmitter } from 'node:events'
import type { Telemetry } from './decode'

export interface DebugFrame {
  length: number
  // hex of the last 8 bytes — useful for mapping any padding/unknown trail
  tailHex: string
}

interface ForzaEvents {
  telemetry: [Telemetry]
  debug: [DebugFrame]
}

class ForzaBus extends EventEmitter<ForzaEvents> {}

export const forzaBus = new ForzaBus()
forzaBus.setMaxListeners(50)
