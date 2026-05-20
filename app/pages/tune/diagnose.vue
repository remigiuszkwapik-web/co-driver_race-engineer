<script setup lang="ts">
import {
  DIAGNOSES,
  SIGNAL_LABEL,
  SIGNAL_WHERE,
  TUNE_CATEGORIES,
  type DiagnosisEntry
} from '~/utils/tuning-reference'

useHead({ title: 'Diagnose by symptom · tuning reference' })

const PHASE_LABEL: Record<DiagnosisEntry['phase'], string> = {
  entry: 'Entry',
  mid: 'Mid-corner',
  exit: 'Exit',
  braking: 'Braking',
  straight: 'Straight',
  bumps: 'Bumps'
}

const PHASE_ORDER: DiagnosisEntry['phase'][] = ['entry', 'mid', 'exit', 'braking', 'straight', 'bumps']

const phaseFilter = ref<DiagnosisEntry['phase'] | 'all'>('all')

const filtered = computed(() =>
  phaseFilter.value === 'all'
    ? DIAGNOSES
    : DIAGNOSES.filter(d => d.phase === phaseFilter.value)
)

const phaseCounts = computed(() => {
  const counts: Record<DiagnosisEntry['phase'], number> = {
    entry: 0, mid: 0, exit: 0, braking: 0, straight: 0, bumps: 0
  }
  for (const d of DIAGNOSES) counts[d.phase]++
  return counts
})

function catTitle(slug: string): string {
  return TUNE_CATEGORIES.find(c => c.slug === slug)?.title ?? slug
}
</script>

<template>
  <main class="mx-auto max-w-4xl px-6 py-10">
    <div class="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
      <NuxtLink
        to="/tune"
        class="hover:text-zinc-300"
      >
        Tuning reference
      </NuxtLink>
      <span class="mx-2 text-zinc-700">/</span>
      <span class="text-zinc-300">Diagnose</span>
    </div>
    <h1 class="mb-3 font-mono text-3xl text-zinc-100">
      Diagnose by symptom
    </h1>
    <p class="mb-8 max-w-2xl font-mono text-sm leading-relaxed text-zinc-400">
      Pick the thing the car is doing wrong. Each entry lists the telemetry signal
      to confirm the diagnosis and the tuning levers to try, in order of how often
      they fix the problem.
    </p>

    <div class="mb-6 flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        class="rounded-sm border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors"
        :class="phaseFilter === 'all'
          ? 'border-green-500/60 bg-green-500/10 text-green-300'
          : 'border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'"
        @click="phaseFilter = 'all'"
      >
        All <span class="ml-1.5 text-zinc-500">{{ DIAGNOSES.length }}</span>
      </button>
      <button
        v-for="p in PHASE_ORDER"
        :key="p"
        type="button"
        class="rounded-sm border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors"
        :class="phaseFilter === p
          ? 'border-green-500/60 bg-green-500/10 text-green-300'
          : 'border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'"
        @click="phaseFilter = p"
      >
        {{ PHASE_LABEL[p] }} <span class="ml-1.5 text-zinc-500">{{ phaseCounts[p] }}</span>
      </button>
    </div>

    <ul class="space-y-3">
      <li
        v-for="d in filtered"
        :key="d.symptom"
        class="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
      >
        <div class="mb-3 flex items-baseline justify-between gap-3">
          <h3 class="font-mono text-lg text-zinc-100">
            {{ d.symptom }}
          </h3>
          <span class="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            {{ PHASE_LABEL[d.phase] }}
          </span>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div class="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              Confirm in telemetry
            </div>
            <ul class="space-y-1.5">
              <li
                v-for="sig in d.signals"
                :key="sig.key"
                class="text-sm"
              >
                <div class="font-mono text-zinc-200">
                  {{ SIGNAL_LABEL[sig.key] }}
                </div>
                <div class="text-xs text-zinc-500">
                  {{ SIGNAL_WHERE[sig.key] }}
                </div>
                <div class="text-zinc-300">
                  {{ sig.look }}
                </div>
              </li>
            </ul>
          </div>

          <div>
            <div class="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              Then try, in order
            </div>
            <ol class="space-y-1.5">
              <li
                v-for="(step, i) in d.investigate"
                :key="step.slug"
                class="text-sm"
              >
                <div class="flex items-baseline gap-2">
                  <span class="font-mono text-xs text-zinc-600 tabular-nums">{{ i + 1 }}.</span>
                  <NuxtLink
                    :to="`/tune/${step.slug}`"
                    class="font-mono text-zinc-100 underline decoration-zinc-600 underline-offset-4 transition-colors hover:decoration-green-400 hover:text-green-300"
                  >
                    {{ catTitle(step.slug) }}
                  </NuxtLink>
                </div>
                <div class="ml-5 text-zinc-300">
                  {{ step.note }}
                </div>
              </li>
            </ol>
          </div>
        </div>
      </li>
    </ul>
  </main>
</template>
