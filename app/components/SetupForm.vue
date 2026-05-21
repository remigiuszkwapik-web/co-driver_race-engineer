<script setup lang="ts">
import {
  BUILD_FIELDS,
  type AutoSource,
  type BuildSettings,
  type SetupField
} from '~/utils/setup-fields'

const props = defineProps<{
  /** The session this form is editing/attaching a setup to. */
  sessionId: number
  /** Car ordinal — for the create/list endpoints. */
  carOrdinal: number
  /** Existing setup id, if editing. */
  existingSetupId?: number | null
  /** Initial snapshot to pre-fill from (when editing). */
  initialBuild?: BuildSettings | null
  /** Initial name to pre-fill (e.g. existing tuneLabel). */
  initialName?: string | null
  /** Auto-populate sources. */
  autoPower?: number | null
  autoPi?: number | null
  autoCarClass?: string | null
  autoDrivetrain?: string | null
}>()

const emit = defineEmits<{
  saved: [session: { id: number, setupId: number | null }]
  cancel: []
}>()

const AUTO_LABELS: Record<AutoSource, string> = {
  dyno_peak_power: 'from dyno',
  session_pi: 'from telemetry',
  car_class: 'from telemetry',
  car_drivetrain: 'from telemetry'
}

function autoValueFor(source: AutoSource | undefined): string | number | null {
  if (!source) return null
  switch (source) {
    case 'dyno_peak_power': return props.autoPower ?? null
    case 'session_pi': return props.autoPi ?? null
    case 'car_class': return props.autoCarClass ?? null
    case 'car_drivetrain': return props.autoDrivetrain ?? null
  }
}

// --- Form state -----------------------------------------------------------

const name = ref(props.initialName ?? '')
const values = reactive<Record<string, string | number | null>>({})

// Initialise from initialBuild OR auto-populated sources.
for (const f of BUILD_FIELDS) {
  const seeded = props.initialBuild?.[f.id as keyof BuildSettings]
  if (seeded !== undefined && seeded !== null && seeded !== '') {
    values[f.id] = seeded
  } else {
    values[f.id] = autoValueFor(f.auto)
  }
}

const saving = ref(false)
const error = ref<string | null>(null)

// --- "Copy from previous setup" -------------------------------------------

interface SetupListEntry {
  id: number
  name: string
  createdAt: string
}

const { data: previousSetups, refresh: refreshPrevious } = await useFetch<SetupListEntry[]>(
  `/api/cars/${props.carOrdinal}/setups`,
  { default: () => [] }
)

const copyFromId = ref<number | null>(null)

async function copyFromPrevious() {
  if (!copyFromId.value) return
  try {
    const setup = await $fetch<{ name: string, build: BuildSettings }>(`/api/setups/${copyFromId.value}`)
    name.value = setup.name + ' (copy)'
    for (const f of BUILD_FIELDS) {
      const v = setup.build?.[f.id as keyof BuildSettings]
      if (v !== undefined) values[f.id] = v as string | number | null
    }
  } catch (err) {
    const e = err as { message?: string }
    error.value = e.message ?? 'Failed to load setup'
  }
}

// --- Save -----------------------------------------------------------------

async function save() {
  if (saving.value) return
  const trimmedName = name.value.trim()
  if (!trimmedName) {
    error.value = 'Name is required'
    return
  }

  saving.value = true
  error.value = null

  // Coerce numeric strings to numbers; trim text; keep nulls.
  const build: BuildSettings = {}
  for (const f of BUILD_FIELDS) {
    const v = values[f.id]
    if (v === null || v === undefined || v === '') continue
    if (f.kind === 'number') {
      const n = Number(v)
      if (Number.isFinite(n)) build[f.id as keyof BuildSettings] = n
    } else if (f.kind === 'text') {
      const s = String(v).trim()
      if (s) build[f.id as keyof BuildSettings] = s
    } else {
      build[f.id as keyof BuildSettings] = v
    }
  }

  try {
    let setupId: number
    if (props.existingSetupId) {
      const updated = await $fetch<{ id: number }>(`/api/setups/${props.existingSetupId}`, {
        method: 'PATCH',
        body: { name: trimmedName, build }
      })
      setupId = updated.id
    } else {
      const created = await $fetch<{ id: number }>(`/api/cars/${props.carOrdinal}/setups`, {
        method: 'POST',
        body: { name: trimmedName, build }
      })
      setupId = created.id
    }

    // Attach to the session + snapshot the build into the session row.
    const session = await $fetch<{ id: number, setupId: number | null }>(`/api/sessions/${props.sessionId}`, {
      method: 'PATCH',
      body: {
        setupId,
        setupSnapshot: { build, tune: null }
      }
    })

    await refreshPrevious()
    emit('saved', session)
  } catch (err) {
    const e = err as { data?: { statusMessage?: string }, statusMessage?: string, message?: string }
    error.value = e.data?.statusMessage ?? e.statusMessage ?? e.message ?? 'Save failed'
  } finally {
    saving.value = false
  }
}

function autoHintFor(field: SetupField): string | null {
  if (!field.auto) return null
  const v = autoValueFor(field.auto)
  if (v === null || v === undefined) return null
  return AUTO_LABELS[field.auto]
}
</script>

<template>
  <section class="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 font-mono">
    <header class="mb-4 flex items-baseline justify-between">
      <div class="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
        {{ existingSetupId ? 'Edit setup details' : 'Add setup details' }}
      </div>
      <button
        type="button"
        class="rounded-sm border border-transparent px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
        @click="emit('cancel')"
      >
        Cancel
      </button>
    </header>

    <!-- Name -->
    <label class="mb-4 flex flex-col gap-1 text-sm">
      <span class="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Setup name</span>
      <input
        v-model="name"
        type="text"
        placeholder="e.g. v1, race-trim, mellow"
        :disabled="saving"
        class="rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
      >
    </label>

    <!-- Copy from previous -->
    <div
      v-if="previousSetups && previousSetups.length"
      class="mb-4 flex items-center gap-2 text-sm"
    >
      <span class="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
        Copy from
      </span>
      <select
        v-model="copyFromId"
        :disabled="saving"
        class="rounded-sm border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
      >
        <option :value="null">
          —
        </option>
        <option
          v-for="s in previousSetups"
          :key="s.id"
          :value="s.id"
        >
          {{ s.name }}
        </option>
      </select>
      <button
        type="button"
        :disabled="saving || !copyFromId"
        class="rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-200 transition-colors hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
        @click="copyFromPrevious"
      >
        Apply
      </button>
    </div>

    <!-- Build fields -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label
        v-for="field in BUILD_FIELDS"
        :key="field.id"
        class="flex flex-col gap-1 text-sm"
      >
        <span class="flex items-baseline justify-between text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          <span>{{ field.label }}</span>
          <span
            v-if="autoHintFor(field)"
            class="text-zinc-600 normal-case tracking-normal"
          >{{ autoHintFor(field) }}</span>
        </span>

        <select
          v-if="field.kind === 'enum'"
          v-model="values[field.id]"
          :disabled="saving"
          class="rounded-sm border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
        >
          <option :value="null">
            —
          </option>
          <option
            v-for="opt in field.options"
            :key="opt"
            :value="opt"
          >
            {{ opt }}
          </option>
        </select>

        <input
          v-else
          v-model="values[field.id]"
          :type="field.kind === 'number' ? 'number' : 'text'"
          :step="field.kind === 'number' ? 'any' : undefined"
          :placeholder="field.unit ? field.unit.trim() : ''"
          :disabled="saving"
          class="rounded-sm border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
        >
      </label>
    </div>

    <div
      v-if="error"
      class="mt-3 rounded-sm border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300"
    >
      {{ error }}
    </div>

    <div class="mt-5 flex justify-end gap-2">
      <button
        type="button"
        :disabled="saving"
        class="rounded-sm border border-zinc-700 bg-zinc-900 px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] text-zinc-200 transition-colors hover:border-zinc-500 disabled:opacity-50"
        @click="emit('cancel')"
      >
        Cancel
      </button>
      <button
        type="button"
        :disabled="saving || !name.trim()"
        class="rounded-sm border border-green-500/60 bg-green-500/10 px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] text-green-300 transition-colors hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        @click="save"
      >
        {{ saving ? 'Saving…' : 'Save changes' }}
      </button>
    </div>
  </section>
</template>
