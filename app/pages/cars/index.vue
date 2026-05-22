<script setup lang="ts">
useHead({ title: 'Garage · forza-data' })

interface CarRow {
  ordinal: number
  class: number
  displayName: string | null
  buildCount: number
  sessionCount: number
  lastUsedAt: string | null
}

const { data: cars } = await useFetch<CarRow[]>('/api/cars', { default: () => [] })

const CLASS_LETTERS = ['D', 'C', 'B', 'A', 'S1', 'S2', 'X', 'R']
function carClassLetter(c: number): string {
  return CLASS_LETTERS[c] ?? '?'
}

function lastDrivenLabel(iso: string | null): string {
  return iso ? relativeDate(iso) : 'never driven'
}
</script>

<template>
  <main class="container mx-auto max-w-6xl px-6 py-10">
    <PageHeader title="Your cars">
      <template #eyebrow>
        Garage
      </template>
    </PageHeader>

    <div
      v-if="cars && cars.length"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <NuxtLink
        v-for="car in cars"
        :key="car.ordinal"
        :to="`/cars/${car.ordinal}`"
        class="group flex flex-col gap-2 card p-5 transition-colors hover:border-zinc-600 hover:bg-zinc-900/60"
      >
        <div class="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 group-hover:text-zinc-400">
          [{{ carClassLetter(car.class) }}] · ordinal {{ car.ordinal }}
        </div>
        <div class="font-mono text-xl text-zinc-100">
          {{ car.displayName ?? `#${car.ordinal}` }}
        </div>
        <div class="mt-2 grid grid-cols-3 gap-2 font-mono text-[11px] text-zinc-400">
          <div>
            <div class="text-[9px] uppercase tracking-[0.2em] text-zinc-600">
              Builds
            </div>
            <div class="text-zinc-200">
              {{ car.buildCount }}
            </div>
          </div>
          <div>
            <div class="text-[9px] uppercase tracking-[0.2em] text-zinc-600">
              Sessions
            </div>
            <div class="text-zinc-200">
              {{ car.sessionCount }}
            </div>
          </div>
          <div>
            <div class="text-[9px] uppercase tracking-[0.2em] text-zinc-600">
              Last used
            </div>
            <div class="text-zinc-200">
              {{ lastDrivenLabel(car.lastUsedAt) }}
            </div>
          </div>
        </div>
      </NuxtLink>
    </div>
    <div
      v-else
      class="card-dashed p-8 text-center font-mono text-sm text-zinc-500"
    >
      No cars yet. Cars appear here once you record a session in Forza
      with telemetry flowing.
    </div>
  </main>
</template>
