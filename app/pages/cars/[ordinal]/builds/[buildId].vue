<script setup lang="ts">
import type { BuildSettings } from '~/utils/build-fields'

const route = useRoute()

const ordinalParam = Number(route.params.ordinal)
const buildIdParam = Number(route.params.buildId)
if (!Number.isInteger(ordinalParam) || ordinalParam <= 0
  || !Number.isInteger(buildIdParam) || buildIdParam <= 0) {
  throw createError({ statusCode: 404, statusMessage: 'not found' })
}
const ordinal = ordinalParam
const buildId = buildIdParam

interface BuildDetail {
  id: number
  carId: number
  carOrdinal: number
  carClass: number
  carDisplayName: string | null
  name: string
  settings: BuildSettings
  createdAt: string
  tuneCount: number
  sessionCount: number
}

const { data: build, refresh: refreshBuild } = await useFetch<BuildDetail>(`/api/builds/${buildId}`)
if (!build.value) {
  throw createError({ statusCode: 404, statusMessage: 'build not found' })
}

useHead({ title: () => `${build.value?.name ?? 'Build'} · ${build.value?.carDisplayName ?? `#${ordinal}`}` })

const editing = ref(false)

const CLASS_LETTERS = ['D', 'C', 'B', 'A', 'S1', 'S2', 'X', 'R']
function carClassLetter(c: number): string {
  return CLASS_LETTERS[c] ?? '?'
}

async function onSaved() {
  editing.value = false
  await refreshBuild()
}
</script>

<template>
  <main class="mx-auto max-w-3xl px-6 py-10">
    <div class="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
      <NuxtLink
        to="/cars"
        class="hover:text-zinc-300"
      >
        Garage
      </NuxtLink>
      <span class="mx-2 text-zinc-700">/</span>
      <NuxtLink
        :to="`/cars/${ordinal}`"
        class="hover:text-zinc-300"
      >
        {{ build?.carDisplayName ?? `#${ordinal}` }}
      </NuxtLink>
      <span class="mx-2 text-zinc-700">/</span>
      <span class="text-zinc-300">{{ build?.name }}</span>
    </div>

    <div class="mb-8 flex items-baseline gap-3">
      <h1 class="font-mono text-3xl text-zinc-100">
        {{ build?.name }}
      </h1>
      <span
        v-if="build"
        class="font-mono text-sm text-zinc-500"
      >[{{ carClassLetter(build.carClass) }}] · {{ build.sessionCount }} session{{ build.sessionCount === 1 ? '' : 's' }}</span>
    </div>

    <section class="mb-8">
      <BuildForm
        v-if="editing && build"
        :car-ordinal="ordinal"
        :existing-build-id="buildId"
        :initial-build="build.settings"
        :initial-name="build.name"
        @saved="onSaved"
        @cancel="editing = false"
      />
      <BuildDisplay
        v-else-if="build"
        :build="build.settings"
        :build-name="build.name"
        @edit="editing = true"
      />
    </section>

    <section
      v-if="build"
      class="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/20 p-6 text-center font-mono text-sm text-zinc-500"
    >
      Tune iteration list arrives in Phase 1b — for now this build's
      tunes live in the slot but aren't editable yet.
    </section>
  </main>
</template>
