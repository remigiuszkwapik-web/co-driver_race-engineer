<script setup lang="ts">
import { adviseUpgrades } from '~/utils/upgrade-advisor'
import { carClassLetter } from '~/utils/class'
import { fh6CarName } from '~/utils/fh6-cars'

useHead({ title: 'Upgrade Advisor · upgrade' })

const { data, pending } = useTuneData()

const classLetter = computed(() => {
  const c = data.value?.car?.class
  return c == null ? null : carClassLetter(c)
})

const report = computed(() => adviseUpgrades(
  data.value
    ? {
        drivetrain: data.value.drivetrain,
        lapCount: data.value.lapCount,
        classLetter: classLetter.value,
        signals: data.value.signals
      }
    : null
))

const carLabel = computed(() => {
  const c = data.value?.car
  if (!c) return null
  return c.displayName ?? fh6CarName(c.ordinal) ?? `Car #${c.ordinal}`
})
</script>

<template>
  <main class="container mx-auto max-w-4xl px-6 py-10">
    <PageHeader title="Upgrade Advisor">
      <template #eyebrow>
        <NuxtLink
          to="/upgrade"
          class="hover:text-zinc-300"
        >
          Upgrade reference
        </NuxtLink>
        <span class="text-zinc-700">/</span>
        <span class="text-zinc-300">Advisor</span>
        <span class="ml-1.5 rounded-sm border border-green-500/40 bg-green-500/10 px-1.5 py-0.5 text-green-300">FH6</span>
      </template>
      <template #intro>
        Build before you tune. This reads your recorded laps, decides what is
        actually limiting the car, and tells you where to spend PI to max the
        class — the direction, not a parts list.
      </template>
    </PageHeader>

    <p
      v-if="pending"
      class="card-dashed p-4 font-mono text-xs text-zinc-500"
    >
      Reading your laps…
    </p>

    <section
      v-else-if="!report.hasData"
      class="card-dashed p-6 font-mono text-sm text-zinc-400"
    >
      <p class="mb-2 text-zinc-200">
        No laps to work from yet.
      </p>
      <p class="text-zinc-500">
        Record a session for this car, then come back — the advisor reads your
        last few laps to spot the limiting factor.
      </p>
    </section>

    <template v-else>
      <div class="mb-5 flex items-baseline gap-x-2 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
        <span class="text-zinc-300">{{ carLabel ?? 'Current car' }}</span>
        <template v-if="classLetter">
          <span class="text-zinc-700">·</span>
          <span>{{ classLetter }}-class</span>
        </template>
        <span class="text-zinc-700">·</span>
        <span>{{ (data?.drivetrain ?? '—').toString().toUpperCase() }}</span>
      </div>

      <section class="card mb-8 border-l-2 border-l-green-500/60 p-6">
        <div class="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-green-400">
          {{ report.limiter === 'grip' ? 'Grip-limited' : 'No single limit' }}
        </div>
        <p class="mb-5 text-base text-zinc-100">
          {{ report.verdict }}
        </p>

        <h3 class="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-zinc-400">
          Spend PI here
        </h3>
        <ol class="mb-5 space-y-3">
          <li
            v-for="(rec, i) in report.recommendations"
            :key="rec.slug"
            class="grid grid-cols-[auto_1fr] gap-x-3"
          >
            <span class="font-mono text-sm text-green-400">{{ i + 1 }}.</span>
            <div>
              <div class="mb-0.5 flex items-baseline justify-between gap-x-3">
                <span class="font-medium text-zinc-100">{{ rec.title }}</span>
                <NuxtLink
                  :to="`/upgrade/${rec.slug}`"
                  class="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-green-400 hover:text-green-300"
                >
                  {{ rec.slug }} →
                </NuxtLink>
              </div>
              <p class="text-sm text-zinc-400">
                {{ rec.why }}
              </p>
            </div>
          </li>
        </ol>

        <p class="text-xs text-zinc-500">
          {{ report.note }}
        </p>
      </section>

      <UButton
        to="/upgrade/homologate"
        color="primary"
        variant="subtle"
        size="sm"
        trailing-icon="i-lucide-arrow-right"
      >
        Build to the class cap (homologate)
      </UButton>
    </template>
  </main>
</template>
