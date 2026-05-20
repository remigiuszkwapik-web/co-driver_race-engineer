<script setup lang="ts">
import { useTimeAgo } from '@vueuse/core'
import type { EventType } from '~/utils/event-types'
import { formatLap } from '~/utils/format'

const props = defineProps<{
  ev: {
    id: number
    name: string
    type: EventType
    bestLapMs: number | null
    lastDrivenAt: string | number | null
  }
  eventTypeKey: EventType
}>()

const hasRuns = computed(() => props.ev.lastDrivenAt != null)

const lastDrivenDate = computed(() => {
  const v = props.ev.lastDrivenAt
  if (v == null) return null
  return typeof v === 'string' ? new Date(v) : new Date(v * 1000)
})

const timeAgo = useTimeAgo(() => lastDrivenDate.value ?? new Date(0))
</script>

<template>
  <li>
    <NuxtLink
      :to="`/events/${eventTypeKey}/${ev.id}`"
      class="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 transition-colors hover:border-zinc-600 hover:bg-zinc-900/60"
    >
      <span class="font-mono text-lg text-zinc-100">{{ ev.name }}</span>
      <span class="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
        <template v-if="hasRuns">
          <span class="tabular-nums text-zinc-200">{{ formatLap(ev.bestLapMs) }}</span>
          <span>{{ timeAgo }}</span>
        </template>
        <template v-else>
          <span class="text-zinc-600">no runs</span>
        </template>
      </span>
    </NuxtLink>
  </li>
</template>
