<script setup lang="ts">
import {
  BUILD_FIELDS,
  type AutoSource,
  type BuildSettings,
  type SetupField
} from '~/utils/build-fields'

const props = defineProps<{
  /** Car ordinal — for the create/list endpoints. */
  carOrdinal: number
  /** Existing build id, if editing an existing build. */
  existingBuildId?: number | null
  /** Initial settings to pre-fill from (when editing). */
  initialBuild?: BuildSettings | null
  /** Initial name to pre-fill. */
  initialName?: string | null
  /** Auto-populate sources. */
  autoPower?: number | null
  autoPi?: number | null
  autoCarClass?: string | null
  autoDrivetrain?: string | null
}>()

const emit = defineEmits<{
  saved: [build: { id: number, name: string }]
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

// --- "Copy from previous build" ------------------------------------------

interface BuildListEntry {
  id: number
  name: string
  createdAt: string
}

const { data: previousBuilds, refresh: refreshPrevious } = await useFetch<BuildListEntry[]>(
  `/api/cars/${props.carOrdinal}/builds`,
  { default: () => [] }
)

const copyFromId = ref<number | null>(null)

async function copyFromPrevious() {
  if (!copyFromId.value) return
  try {
    const build = await $fetch<{ name: string, settings: BuildSettings }>(`/api/builds/${copyFromId.value}`)
    name.value = build.name + ' (copy)'
    for (const f of BUILD_FIELDS) {
      const v = build.settings?.[f.id as keyof BuildSettings]
      if (v !== undefined) values[f.id] = v as string | number | null
    }
  } catch (err) {
    const e = err as { message?: string }
    error.value = e.message ?? 'Failed to load build'
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

  const settings: BuildSettings = {}
  for (const f of BUILD_FIELDS) {
    const v = values[f.id]
    if (v === null || v === undefined || v === '') continue
    if (f.kind === 'number') {
      const n = Number(v)
      if (Number.isFinite(n)) settings[f.id as keyof BuildSettings] = n
    } else if (f.kind === 'text') {
      const s = String(v).trim()
      if (s) settings[f.id as keyof BuildSettings] = s
    } else {
      settings[f.id as keyof BuildSettings] = v
    }
  }

  try {
    let build: { id: number, name: string }
    if (props.existingBuildId) {
      build = await $fetch<{ id: number, name: string }>(`/api/builds/${props.existingBuildId}`, {
        method: 'PATCH',
        body: { name: trimmedName, settings }
      })
    } else {
      build = await $fetch<{ id: number, name: string }>(`/api/cars/${props.carOrdinal}/builds`, {
        method: 'POST',
        body: { name: trimmedName, settings }
      })
    }
    await refreshPrevious()
    emit('saved', build)
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
  <section class="card p-4 font-mono">
    <header class="mb-4 flex items-baseline justify-between">
      <div class="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
        {{ existingBuildId ? 'Edit build' : 'Add build' }}
      </div>
      <button
        type="button"
        class="rounded-sm border border-transparent px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
        @click="emit('cancel')"
      >
        Cancel
      </button>
    </header>

    <label class="mb-4 flex flex-col gap-1 text-sm">
      <span class="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Build name</span>
      <input
        v-model="name"
        type="text"
        placeholder="e.g. S2 race trim"
        :disabled="saving"
        class="rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
      >
    </label>

    <div
      v-if="previousBuilds && previousBuilds.length"
      class="mb-4 flex items-center gap-2 text-sm"
    >
      <span class="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Copy from</span>
      <select
        v-model="copyFromId"
        :disabled="saving"
        class="rounded-sm border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
      >
        <option :value="null">
          —
        </option>
        <option
          v-for="b in previousBuilds"
          :key="b.id"
          :value="b.id"
        >
          {{ b.name }}
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
