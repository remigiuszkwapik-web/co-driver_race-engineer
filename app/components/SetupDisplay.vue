<script setup lang="ts">
import { BUILD_FIELDS, formatFieldValue, type BuildSettings } from '~/utils/setup-fields'

const props = defineProps<{
  build: BuildSettings
  setupName?: string | null
}>()

const emit = defineEmits<{
  edit: []
}>()

interface Row {
  id: string
  label: string
  value: string
}

const rows = computed<Row[]>(() => {
  return BUILD_FIELDS.map(f => ({
    id: f.id,
    label: f.label,
    value: formatFieldValue(f, props.build[f.id as keyof BuildSettings] ?? null)
  }))
})
</script>

<template>
  <section class="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 font-mono">
    <header class="mb-3 flex items-baseline justify-between">
      <div class="flex items-baseline gap-3 text-[10px] uppercase tracking-[0.3em] text-zinc-500">
        <span>Setup details</span>
        <span
          v-if="setupName"
          class="normal-case tracking-normal text-zinc-300"
        >{{ setupName }}</span>
      </div>
      <button
        type="button"
        class="rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-zinc-200 transition-colors hover:border-zinc-500"
        @click="emit('edit')"
      >
        Edit
      </button>
    </header>

    <dl class="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="row in rows"
        :key="row.id"
        class="flex items-baseline justify-between gap-3 border-b border-zinc-800/60 py-1"
      >
        <dt class="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          {{ row.label }}
        </dt>
        <dd class="tabular-nums text-zinc-200">
          {{ row.value }}
        </dd>
      </div>
    </dl>
  </section>
</template>
