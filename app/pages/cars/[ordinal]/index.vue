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
        <UInput
          v-model="nameDraft"
          :placeholder="`#${ordinal}`"
          :disabled="savingName"
          autofocus
          class="min-w-0 flex-1"
          :ui="{ base: 'text-2xl' }"
          @keydown.enter.prevent="saveName"
          @keydown.escape.prevent="cancelEditName"
        />
        <UButton
          :label="savingName ? 'Saving…' : 'Save'"
          color="primary"
          variant="outline"
          :loading="savingName"
          :disabled="savingName"
          class="font-mono text-[11px] uppercase tracking-[0.2em]"
          @click="saveName"
        />
        <UButton
          label="Cancel"
          color="neutral"
          variant="ghost"
          :disabled="savingName"
          class="font-mono text-[11px] uppercase tracking-[0.2em]"
          @click="cancelEditName"
        />
      </template>
      <template v-else>
        <h1 class="font-mono text-3xl text-zinc-100">
          {{ car?.displayName ?? `#${ordinal}` }}
        </h1>
        <span
          v-if="car"
          class="font-mono text-sm text-zinc-500"
        >[{{ carClassLetter(car.class) }}]</span>
        <UButton
          label="rename"
          color="neutral"
          variant="link"
          size="xs"
          class="ml-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600 hover:text-zinc-300"
          @click="startEditName"
        />
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
        <UInput
          v-model="newName"
          placeholder="e.g. S2 race trim"
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
    <UEmpty
      v-else
      icon="i-lucide-wrench"
      title="No builds yet"
      description="Create one above."
      class="card-dashed font-mono"
    />
  </main>
</template>
