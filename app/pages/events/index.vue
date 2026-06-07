<script setup lang="ts">
import { EVENT_TYPE_LABELS, EVENT_TYPE_ORDER, type EventType } from '~/utils/event-types'

interface EventRow {
  id: number
  name: string
  type: EventType
  createdAt: number | string
}

// Scope event counts to the active game (workspace).
const { gameId } = useGame()
const { data: events } = await useFetch<EventRow[]>('/api/events', {
  query: { gameId },
  default: () => []
})

const counts = computed<Record<EventType, number>>(() => {
  const c: Record<EventType, number> = {
    rally: 0, race: 0, street_race: 0, touge: 0, cross_country: 0, drag: 0, custom: 0, freeroam: 0
  }
  for (const e of events.value ?? []) c[e.type]++
  return c
})
</script>

<template>
  <main class="container mx-auto max-w-6xl px-6 py-10">
    <PageHeader title="Pick an event type">
      <template #eyebrow>
        Events
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="type in EVENT_TYPE_ORDER"
        :key="type"
        :to="`/events/${type}`"
        class="group flex flex-col gap-2 card p-6 transition-colors hover:border-zinc-600 hover:bg-zinc-900/60"
      >
        <div class="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 group-hover:text-zinc-400">
          {{ counts[type] }} event{{ counts[type] === 1 ? '' : 's' }}
        </div>
        <div class="font-mono text-2xl text-zinc-100">
          {{ EVENT_TYPE_LABELS[type] }}
        </div>
      </NuxtLink>
    </div>
  </main>
</template>
