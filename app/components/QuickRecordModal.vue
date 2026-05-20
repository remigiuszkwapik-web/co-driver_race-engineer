<script setup lang="ts">
import { EVENT_TYPE_LABELS, EVENT_TYPE_ORDER, type EventType } from '~/utils/event-types'

const open = defineModel<boolean>('open', { required: true })

interface EventRow {
  id: number
  name: string
  type: EventType
  createdAt: number | string
  bestLapMs: number | null
  lastDrivenAt: number | string | null
}

const { startRecording, lastError, clearError } = useRecording()

const step = ref<'type' | 'event'>('type')
const selectedType = ref<EventType | null>(null)
const selectedEventId = ref<number | null>(null)
const newEventName = ref('')
const tuneLabel = ref('')

const eventsForType = ref<EventRow[]>([])
const loadingEvents = ref(false)
const creating = ref(false)
const submitting = ref(false)
const localError = ref<string | null>(null)

function reset() {
  step.value = 'type'
  selectedType.value = null
  selectedEventId.value = null
  newEventName.value = ''
  tuneLabel.value = ''
  eventsForType.value = []
  loadingEvents.value = false
  creating.value = false
  submitting.value = false
  localError.value = null
}

function close() {
  open.value = false
  reset()
  clearError()
}

watch(open, (v) => {
  if (v) {
    reset()
    clearError()
  }
})

async function pickType(t: EventType) {
  selectedType.value = t
  step.value = 'event'
  selectedEventId.value = null
  newEventName.value = ''
  loadingEvents.value = true
  localError.value = null
  try {
    eventsForType.value = await $fetch<EventRow[]>('/api/events', { query: { type: t } })
  } catch (err) {
    const e = err as { data?: { statusMessage?: string }, message?: string }
    localError.value = e.data?.statusMessage ?? e.message ?? 'failed to load events'
  } finally {
    loadingEvents.value = false
  }
}

async function createAndStart() {
  if (!selectedType.value) return
  const name = newEventName.value.trim()
  if (!name) return
  creating.value = true
  localError.value = null
  try {
    const created = await $fetch<EventRow>('/api/events', {
      method: 'POST',
      body: { name, type: selectedType.value }
    })
    selectedEventId.value = created.id
    eventsForType.value = [...eventsForType.value, created]
    newEventName.value = ''
    await startAndClose()
  } catch (err) {
    const e = err as { data?: { statusMessage?: string }, message?: string }
    localError.value = e.data?.statusMessage ?? e.message ?? 'create failed'
  } finally {
    creating.value = false
  }
}

async function startAndClose() {
  if (!selectedEventId.value) return
  submitting.value = true
  localError.value = null
  const label = tuneLabel.value.trim() || null
  const ok = startRecording(selectedEventId.value, label)
  submitting.value = false
  if (!ok) {
    localError.value = 'WebSocket not connected'
    return
  }
  // server may bounce back an error async; let the user see it before navigating.
  await nextTick()
  if (lastError.value) {
    localError.value = lastError.value
    return
  }
  close()
  await navigateTo('/live')
}

function back() {
  step.value = 'type'
  selectedEventId.value = null
  newEventName.value = ''
  eventsForType.value = []
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-40 flex items-center justify-center bg-zinc-950/80 px-4 backdrop-blur-sm"
    @click.self="close"
  >
    <div class="w-full max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 p-6 font-mono">
      <header class="mb-4 flex items-center justify-between">
        <div>
          <div class="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
            Quick record
          </div>
          <h2 class="mt-1 text-xl text-zinc-100">
            {{ step === 'type' ? 'Pick a type' : EVENT_TYPE_LABELS[selectedType!] }}
          </h2>
        </div>
        <button
          type="button"
          class="rounded-sm border border-zinc-700 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
          @click="close"
        >
          Close
        </button>
      </header>

      <!-- Step 1: type tiles -->
      <div
        v-if="step === 'type'"
        class="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        <button
          v-for="t in EVENT_TYPE_ORDER"
          :key="t"
          type="button"
          class="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-4 text-left text-sm text-zinc-100 transition-colors hover:border-zinc-600 hover:bg-zinc-900/80"
          @click="pickType(t)"
        >
          {{ EVENT_TYPE_LABELS[t] }}
        </button>
      </div>

      <!-- Step 2: event picker + tune label + start -->
      <div
        v-else
        class="space-y-3"
      >
        <button
          type="button"
          class="text-[10px] uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-300"
          @click="back"
        >
          ← back to types
        </button>

        <div
          v-if="loadingEvents"
          class="text-sm text-zinc-500"
        >
          Loading…
        </div>
        <div
          v-else-if="eventsForType.length > 0"
          class="space-y-1"
        >
          <div class="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            Pick existing
          </div>
          <select
            v-model.number="selectedEventId"
            class="w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
          >
            <option :value="null">
              — select an event —
            </option>
            <option
              v-for="ev in eventsForType"
              :key="ev.id"
              :value="ev.id"
            >
              {{ ev.name }}
            </option>
          </select>
        </div>

        <div class="space-y-1">
          <div class="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            …or create new
          </div>
          <form
            class="flex gap-2"
            @submit.prevent="createAndStart"
          >
            <input
              v-model="newEventName"
              type="text"
              :placeholder="`new ${EVENT_TYPE_LABELS[selectedType!].toLowerCase()} event`"
              class="flex-1 rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
              :disabled="creating || submitting"
            >
            <button
              type="submit"
              :disabled="creating || submitting || !newEventName.trim()"
              class="rounded-sm border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-zinc-200 transition-colors hover:border-green-500/60 hover:text-green-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {{ creating ? '…' : 'Create & start' }}
            </button>
          </form>
        </div>

        <div class="space-y-1">
          <div class="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            Tune label (optional)
          </div>
          <input
            v-model="tuneLabel"
            type="text"
            placeholder="e.g. race build v2"
            class="w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
            :disabled="creating || submitting"
          >
        </div>

        <div
          v-if="localError"
          class="rounded-sm border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300"
        >
          {{ localError }}
        </div>

        <div class="flex justify-end">
          <button
            type="button"
            class="rounded-sm border border-green-500/40 bg-green-500/10 px-5 py-2 text-[11px] uppercase tracking-[0.2em] text-green-300 transition-colors hover:border-green-400/60 hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!selectedEventId || submitting || creating"
            @click="startAndClose"
          >
            <span class="mr-2 inline-block h-2 w-2 align-middle rounded-full bg-green-400" />
            {{ submitting ? 'Starting…' : 'Start recording' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
