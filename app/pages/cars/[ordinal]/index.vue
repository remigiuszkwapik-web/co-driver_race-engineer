<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const ordinalParam = Number(route.params.ordinal)
if (!Number.isInteger(ordinalParam) || ordinalParam < 0) {
  throw createError({ statusCode: 404, statusMessage: 'invalid car ordinal' })
}
const ordinal = ordinalParam

interface CarRow {
  ordinal: number
  class: number
  displayName: string | null
}
interface BuildRow {
  id: number
  name: string
  createdAt: string
  tuneCount: number
  sessionCount: number
  lastUsedAt: string | null
}

const { data: cars, refresh: refreshCars } = await useFetch<CarRow[]>('/api/cars', { default: () => [] })
const car = computed(() => cars.value?.find(c => c.ordinal === ordinal) ?? null)

const editingName = ref(false)
const nameDraft = ref('')
const savingName = ref(false)
const nameError = ref<string | null>(null)

function startEditName() {
  nameDraft.value = car.value?.displayName ?? ''
  nameError.value = null
  editingName.value = true
}

function cancelEditName() {
  editingName.value = false
  nameError.value = null
}

async function saveName() {
  if (savingName.value) return
  const trimmed = nameDraft.value.trim()
  savingName.value = true
  nameError.value = null
  try {
    await $fetch(`/api/cars/${ordinal}`, {
      method: 'PATCH',
      body: { displayName: trimmed.length ? trimmed : null }
    })
    await refreshCars()
    editingName.value = false
  } catch (err) {
    const e = err as { data?: { statusMessage?: string }, statusMessage?: string, message?: string }
    nameError.value = e.data?.statusMessage ?? e.statusMessage ?? e.message ?? 'rename failed'
  } finally {
    savingName.value = false
  }
}

const { data: builds, refresh: refreshBuilds } = await useFetch<BuildRow[]>(
  `/api/cars/${ordinal}/builds`,
  { default: () => [] }
)

useHead({ title: () => `${car.value?.displayName ?? `#${ordinal}`} · garage` })

// "New build" inline entry
const newName = ref('')
const creating = ref(false)
const errorMessage = ref<string | null>(null)

async function createBuild() {
  const trimmed = newName.value.trim()
  if (!trimmed || creating.value) return
  creating.value = true
  errorMessage.value = null
  try {
    const created = await $fetch<{ id: number }>(`/api/cars/${ordinal}/builds`, {
      method: 'POST',
      body: { name: trimmed, settings: {} }
    })
    newName.value = ''
    await refreshBuilds()
    await router.push(`/cars/${ordinal}/builds/${created.id}`)
  } catch (err) {
    const e = err as { data?: { statusMessage?: string }, statusMessage?: string, message?: string }
    errorMessage.value = e.data?.statusMessage ?? e.statusMessage ?? e.message ?? 'create failed'
  } finally {
    creating.value = false
  }
}

const CLASS_LETTERS = ['D', 'C', 'B', 'A', 'S1', 'S2', 'X', 'R']
function carClassLetter(c: number): string {
  return CLASS_LETTERS[c] ?? '?'
}
</script>

<template>
  <main class="container mx-auto max-w-6xl px-6 py-10">
    <div class="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
      <NuxtLink
        to="/cars"
        class="hover:text-zinc-300"
      >
        Garage
      </NuxtLink>
      <span class="mx-2 text-zinc-700">/</span>
      <span class="text-zinc-300">{{ car?.displayName ?? `#${ordinal}` }}</span>
    </div>

    <div class="mb-8 flex items-baseline gap-3">
      <template v-if="editingName">
        <input
          v-model="nameDraft"
          type="text"
          :placeholder="`#${ordinal}`"
          class="min-w-0 flex-1 rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-1 font-mono text-2xl text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
          :disabled="savingName"
          autofocus
          @keydown.enter.prevent="saveName"
          @keydown.escape.prevent="cancelEditName"
        >
        <button
          type="button"
          class="rounded-sm border border-zinc-700 bg-zinc-900 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-200 transition-colors hover:border-green-500/60 hover:text-green-300 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="savingName"
          @click="saveName"
        >
          {{ savingName ? 'Saving…' : 'Save' }}
        </button>
        <button
          type="button"
          class="rounded-sm border border-zinc-800 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 transition-colors hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="savingName"
          @click="cancelEditName"
        >
          Cancel
        </button>
      </template>
      <template v-else>
        <h1 class="font-mono text-3xl text-zinc-100">
          {{ car?.displayName ?? `#${ordinal}` }}
        </h1>
        <span
          v-if="car"
          class="font-mono text-sm text-zinc-500"
        >[{{ carClassLetter(car.class) }}]</span>
        <button
          type="button"
          class="ml-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600 transition-colors hover:text-zinc-300"
          @click="startEditName"
        >
          rename
        </button>
      </template>
    </div>
    <div
      v-if="nameError"
      class="mb-4 font-mono text-xs text-red-400"
    >
      {{ nameError }}
    </div>

    <section class="mb-8 card p-4">
      <div class="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
        New build
      </div>
      <form
        class="flex gap-2"
        @submit.prevent="createBuild"
      >
        <input
          v-model="newName"
          type="text"
          placeholder="e.g. S2 race trim"
          class="flex-1 rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
          :disabled="creating"
        >
        <button
          type="submit"
          class="rounded-sm border border-zinc-700 bg-zinc-900 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-200 transition-colors hover:border-green-500/60 hover:text-green-300 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="creating || !newName.trim()"
        >
          {{ creating ? 'Creating…' : 'Create' }}
        </button>
      </form>
      <div
        v-if="errorMessage"
        class="mt-2 font-mono text-xs text-red-400"
      >
        {{ errorMessage }}
      </div>
    </section>

    <ul
      v-if="builds && builds.length"
      class="space-y-2"
    >
      <li
        v-for="build in builds"
        :key="build.id"
      >
        <NuxtLink
          :to="`/cars/${ordinal}/builds/${build.id}`"
          class="group flex items-center justify-between card p-4 transition-colors hover:border-zinc-600 hover:bg-zinc-900/60"
        >
          <div class="font-mono">
            <div class="text-zinc-100">
              {{ build.name }}
            </div>
            <div class="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              {{ build.tuneCount }} tune{{ build.tuneCount === 1 ? '' : 's' }} · {{ build.sessionCount }} session{{ build.sessionCount === 1 ? '' : 's' }}
            </div>
          </div>
          <span class="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 group-hover:text-zinc-300">
            →
          </span>
        </NuxtLink>
      </li>
    </ul>
    <div
      v-else
      class="card-dashed p-8 text-center font-mono text-sm text-zinc-500"
    >
      No builds yet. Create one above.
    </div>
  </main>
</template>
