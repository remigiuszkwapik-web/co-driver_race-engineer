<script setup lang="ts">
import { EVENT_TYPE_LABELS, isEventType, type EventType } from '~/utils/event-types'

const route = useRoute()
const router = useRouter()

const typeParam = String(route.params.type ?? '')
if (!isEventType(typeParam)) {
  throw createError({ statusCode: 404, statusMessage: 'unknown event type' })
}
const eventTypeKey = typeParam as EventType

interface EventRow {
  id: number
  name: string
  type: EventType
  createdAt: number | string
  bestLapMs: number | null
  lastDrivenAt: string | number | null
}

const { data: events, refresh } = await useFetch<EventRow[]>('/api/events', {
  query: { type: eventTypeKey },
  default: () => []
})

const newName = ref('')
const creating = ref(false)
const errorMessage = ref<string | null>(null)

const PLACEHOLDERS: Record<EventType, string> = {
  race: 'e.g. Goliath',
  street_race: 'e.g. Cancun Street Circuit',
  touge: 'e.g. Akagi Downhill',
  rally: 'e.g. Sierra Nueva Sprint',
  cross_country: 'e.g. Quad Crossing',
  drag: 'e.g. Airfield 1/4 mile',
  custom: 'e.g. My Eventlab Circuit',
  freeroam: 'e.g. Mulege coastal run'
}
const placeholder = computed(() => PLACEHOLDERS[eventTypeKey])

async function createEvent() {
  const name = newName.value.trim()
  if (!name || creating.value) return
  creating.value = true
  errorMessage.value = null
  try {
    const created = await $fetch<EventRow>('/api/events', {
      method: 'POST',
      body: { name, type: eventTypeKey }
    })
    newName.value = ''
    await refresh()
    await router.push(`/events/${eventTypeKey}/${created.id}`)
  } catch (err) {
    const e = err as { data?: { statusMessage?: string }, statusMessage?: string, message?: string }
    errorMessage.value = e.data?.statusMessage ?? e.statusMessage ?? e.message ?? 'create failed'
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <main class="container mx-auto max-w-6xl px-6 py-10">
    <PageHeader :title="EVENT_TYPE_LABELS[eventTypeKey]">
      <template #eyebrow>
        <NuxtLink
          to="/events"
          class="hover:text-zinc-300"
        >
          Events
        </NuxtLink>
        <span class="text-zinc-700">/</span>
        <span class="text-zinc-300">{{ EVENT_TYPE_LABELS[eventTypeKey] }}</span>
      </template>
    </PageHeader>

    <section class="mb-8 card p-4">
      <div class="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
        New event
      </div>
      <form
        class="flex gap-2"
        @submit.prevent="createEvent"
      >
        <UInput
          v-model="newName"
          :placeholder="placeholder"
          :disabled="creating"
          class="flex-1"
          :ui="{ base: 'text-sm' }"
        />
        <UButton
          type="submit"
          :label="creating ? 'Creating…' : 'Create'"
          color="primary"
          variant="outline"
          :loading="creating"
          :disabled="creating || !newName.trim()"
          class="font-mono text-[11px] uppercase tracking-[0.2em]"
        />
      </form>
      <div
        v-if="errorMessage"
        class="mt-2 font-mono text-xs text-red-400"
      >
        {{ errorMessage }}
      </div>
    </section>

    <ul
      v-if="events && events.length"
      class="space-y-2"
    >
      <EventRowItem
        v-for="ev in events"
        :key="ev.id"
        :ev="ev"
        :event-type-key="eventTypeKey"
      />
    </ul>
    <UEmpty
      v-else
      icon="i-lucide-flag"
      :title="`No ${EVENT_TYPE_LABELS[eventTypeKey].toLowerCase()} events yet`"
      description="Create one above."
      class="card-dashed font-mono"
    />
  </main>
</template>
