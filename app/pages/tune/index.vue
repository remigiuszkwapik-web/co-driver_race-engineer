<script setup lang="ts">
import { TUNE_CATEGORIES, DIAGNOSES } from '~/utils/tuning-reference'

useHead({ title: 'Tuning reference · forza-data' })

const PHASE_LABEL: Record<typeof DIAGNOSES[number]['phase'], string> = {
  entry: 'Entry',
  mid: 'Mid-corner',
  exit: 'Exit',
  braking: 'Braking',
  straight: 'Straight',
  bumps: 'Bumps'
}
</script>

<template>
  <main class="mx-auto max-w-5xl px-6 py-10">
    <div class="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
      <span>Tuning reference</span>
      <span class="rounded-sm border border-green-500/40 bg-green-500/10 px-1.5 py-0.5 text-green-300">FH6</span>
    </div>
    <h1 class="mb-3 font-mono text-3xl text-zinc-100">
      What's this lever do?
    </h1>
    <p class="mb-10 max-w-2xl font-mono text-sm leading-relaxed text-zinc-400">
      Every setting in the upgrade & tune menu for Forza Horizon 6, what it
      changes in the car, which telemetry signal it leaves a fingerprint on, and
      what to reach for when the car does the wrong thing. Distilled from years
      of FH community knowledge and updated for FH6's caster sensitivity, fixed
      brake-bias slider, aero-balance slider, and narrower diff ranges.
    </p>

    <section class="mb-12">
      <div class="mb-3 flex items-baseline justify-between">
        <h2 class="font-mono text-xs uppercase tracking-[0.3em] text-zinc-400">
          By category
        </h2>
        <NuxtLink
          to="/tune/diagnose"
          class="font-mono text-[10px] uppercase tracking-[0.3em] text-green-400 transition-colors hover:text-green-300"
        >
          Diagnose by symptom →
        </NuxtLink>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="cat in TUNE_CATEGORIES"
          :key="cat.slug"
          :to="`/tune/${cat.slug}`"
          class="group flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 transition-colors hover:border-zinc-600 hover:bg-zinc-900/60"
        >
          <div class="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 group-hover:text-zinc-400">
            <UIcon
              :name="`i-lucide-${cat.icon}`"
              class="h-3.5 w-3.5"
            />
            <span>{{ cat.slug }}</span>
          </div>
          <div class="font-mono text-lg text-zinc-100">
            {{ cat.title }}
          </div>
          <p class="text-sm leading-relaxed text-zinc-400">
            {{ cat.summary }}
          </p>
        </NuxtLink>
      </div>
    </section>

    <section>
      <div class="mb-3 flex items-baseline justify-between">
        <h2 class="font-mono text-xs uppercase tracking-[0.3em] text-zinc-400">
          Quick diagnose
        </h2>
        <NuxtLink
          to="/tune/diagnose"
          class="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          All symptoms →
        </NuxtLink>
      </div>
      <ul class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <li
          v-for="d in DIAGNOSES.slice(0, 6)"
          :key="d.symptom"
          class="rounded-md border border-zinc-800/80 bg-zinc-900/30 p-3"
        >
          <div class="flex items-baseline justify-between gap-3">
            <span class="font-mono text-sm text-zinc-200">{{ d.symptom }}</span>
            <span class="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">{{ PHASE_LABEL[d.phase] }}</span>
          </div>
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            <NuxtLink
              v-for="step in d.investigate.slice(0, 3)"
              :key="step.slug"
              :to="`/tune/${step.slug}`"
              class="rounded-sm border border-zinc-800 bg-zinc-950/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
            >
              {{ step.slug }}
            </NuxtLink>
          </div>
        </li>
      </ul>
    </section>
  </main>
</template>
