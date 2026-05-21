<script setup lang="ts">
const props = defineProps<{
  carOrdinal: number
  /** Current attached build (if any) — to highlight in the picker. */
  currentBuildId?: number | null
  /** Disable interaction (e.g. while parent is saving). */
  disabled?: boolean
}>()

const emit = defineEmits<{
  attach: [buildId: number]
}>()

interface BuildListEntry {
  id: number
  name: string
  createdAt: string
  tuneCount: number
  sessionCount: number
}

const { data: builds, pending } = await useFetch<BuildListEntry[]>(
  () => `/api/cars/${props.carOrdinal}/builds`,
  { default: () => [] }
)

const selected = ref<number | null>(props.currentBuildId ?? null)
const error = ref<string | null>(null)

watch(() => props.currentBuildId, (v) => {
  selected.value = v ?? null
})

async function attachSelected() {
  if (!selected.value || props.disabled) return
  error.value = null
  emit('attach', selected.value)
}
</script>

<template>
  <section class="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/20 p-4 font-mono">
    <div class="mb-3 flex items-baseline justify-between text-[10px] uppercase tracking-[0.3em] text-zinc-500">
      <span>Attach a build</span>
      <NuxtLink
        :to="`/cars/${carOrdinal}`"
        class="normal-case tracking-normal text-green-400 transition-colors hover:text-green-300"
      >
        + Create or edit builds in the garage →
      </NuxtLink>
    </div>

    <div
      v-if="pending"
      class="text-sm text-zinc-500"
    >
      Loading builds…
    </div>
    <div
      v-else-if="builds && builds.length"
      class="flex items-center gap-2"
    >
      <select
        v-model="selected"
        :disabled="disabled"
        class="flex-1 rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
      >
        <option :value="null">
          — select a build —
        </option>
        <option
          v-for="b in builds"
          :key="b.id"
          :value="b.id"
        >
          {{ b.name }} ({{ b.sessionCount }} session{{ b.sessionCount === 1 ? '' : 's' }})
        </option>
      </select>
      <button
        type="button"
        :disabled="disabled || !selected || selected === currentBuildId"
        class="rounded-sm border border-green-500/60 bg-green-500/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-green-300 transition-colors hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        @click="attachSelected"
      >
        Attach
      </button>
    </div>
    <div
      v-else
      class="text-sm text-zinc-400"
    >
      No builds saved for this car yet.
      <NuxtLink
        :to="`/cars/${carOrdinal}`"
        class="text-green-400 transition-colors hover:text-green-300"
      >
        Create one in the garage →
      </NuxtLink>
    </div>

    <div
      v-if="error"
      class="mt-3 rounded-sm border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300"
    >
      {{ error }}
    </div>
  </section>
</template>
