<script setup lang="ts">
import { analyzeCar, type Severity } from '~/utils/engineer'
import { progressHints, type HintDirection } from '~/utils/engineer-progress'
import { fh6CarName } from '~/utils/fh6-cars'

useHead({ title: 'Race Engineer · tuning' })

const { data, pending } = useTuneData()
const { data: progressData } = useEngineerProgress()

const report = computed(() => analyzeCar(data.value ?? null))

const progress = computed(() =>
  progressHints(progressData.value?.current ?? null, progressData.value?.previous ?? null)
)

const HINT_DOT: Record<HintDirection, string> = {
  better: 'bg-green-400',
  worse: 'bg-rose-400',
  flat: 'bg-zinc-500'
}

const carLabel = computed(() => {
  const c = data.value?.car
  if (!c) return null
  return c.displayName ?? fh6CarName(c.ordinal) ?? `Car #${c.ordinal}`
})

const SEVERITY_STYLE: Record<Severity, { chip: string, label: string }> = {
  high: { chip: 'border-rose-500/40 bg-rose-500/10 text-rose-300', label: 'Priority' },
  medium: { chip: 'border-amber-500/40 bg-amber-500/10 text-amber-300', label: 'Worth fixing' },
  low: { chip: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300', label: 'Minor' }
}
</script>

<template>
  <main class="container mx-auto max-w-4xl px-6 py-10">
    <PageHeader title="Race Engineer">
      <template #eyebrow>
        <NuxtLink
          to="/tune"
          class="hover:text-zinc-300"
        >
          Tuning reference
        </NuxtLink>
        <span class="text-zinc-700">/</span>
        <span class="text-zinc-300">Race Engineer</span>
        <span class="ml-1.5 rounded-sm border border-green-500/40 bg-green-500/10 px-1.5 py-0.5 text-green-300">FH6</span>
      </template>
      <template #intro>
        The debrief the other pages leave to you. This reads your recorded laps,
        ranks what the car is doing wrong, and names the <em>one</em> change to try
        next — with the reason. Fix it, drive again, come back.
      </template>
    </PageHeader>

    <!-- Loading -->
    <p
      v-if="pending"
      class="card-dashed p-4 font-mono text-xs text-zinc-500"
    >
      Reading your laps…
    </p>

    <!-- No data -->
    <section
      v-else-if="!report.hasData"
      class="card-dashed p-6 font-mono text-sm text-zinc-400"
    >
      <p class="mb-2 text-zinc-200">
        No laps to debrief yet.
      </p>
      <p class="text-zinc-500">
        Record a session (point Forza's Data Out at this server on port 5300), then
        come back — the engineer works off your last few laps for the current car.
      </p>
    </section>

    <template v-else>
      <!-- Car context -->
      <div class="mb-5 flex items-baseline gap-x-2 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
        <span class="text-zinc-300">{{ carLabel ?? 'Current car' }}</span>
        <span class="text-zinc-700">·</span>
        <span>{{ (data?.drivetrain ?? '—').toString().toUpperCase() }}</span>
        <span class="text-zinc-700">·</span>
        <span>last {{ data?.lapCount }} {{ data?.lapCount === 1 ? 'lap' : 'laps' }}</span>
      </div>

      <!-- Since your last session -->
      <section
        v-if="progress.hasComparison && progress.hints.length > 0"
        class="card mb-6 p-4"
      >
        <div class="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-400">
          Since your last session
        </div>
        <ul class="space-y-1.5">
          <li
            v-for="hint in progress.hints"
            :key="hint.id"
            class="flex items-baseline gap-x-2 text-sm text-zinc-300"
          >
            <span
              class="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              :class="HINT_DOT[hint.direction]"
            />
            <span>{{ hint.text }}</span>
          </li>
        </ul>
      </section>
      <p
        v-else-if="progress.note"
        class="mb-6 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600"
      >
        {{ progress.note }}
      </p>

      <!-- All clear -->
      <section
        v-if="report.headline === null"
        class="card p-6"
      >
        <div class="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-green-400">
          Verdict
        </div>
        <p class="text-sm text-zinc-300">
          {{ report.allClear }}
        </p>
      </section>

      <template v-else>
        <!-- Headline recommendation -->
        <section class="card mb-8 border-l-2 border-l-green-500/60 p-6">
          <div class="mb-2 flex items-center gap-x-2">
            <span class="font-mono text-[10px] uppercase tracking-[0.3em] text-green-400">
              Do this next
            </span>
            <span
              class="rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em]"
              :class="SEVERITY_STYLE[report.headline.severity].chip"
            >
              {{ SEVERITY_STYLE[report.headline.severity].label }}
            </span>
          </div>
          <h2 class="mb-1 text-lg font-semibold text-zinc-100">
            {{ report.headline.title }}
          </h2>
          <p class="mb-3 text-sm text-zinc-400">
            {{ report.headline.evidence }}
          </p>
          <p class="mb-4 text-base text-zinc-100">
            <span class="text-green-400">→</span> {{ report.headline.lever }}
          </p>
          <p class="mb-4 text-xs text-zinc-500">
            {{ report.headline.why }}
          </p>
          <UButton
            :to="`/tune/${report.headline.slug}`"
            color="primary"
            variant="subtle"
            size="sm"
            trailing-icon="i-lucide-arrow-right"
          >
            Open {{ report.headline.slug }} reference
          </UButton>
        </section>

        <!-- Full ranked list -->
        <section v-if="report.findings.length > 1">
          <h3 class="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-zinc-400">
            Everything the data flagged
          </h3>
          <ol class="space-y-3">
            <li
              v-for="finding in report.findings"
              :key="finding.id"
              class="card grid grid-cols-[auto_1fr] gap-x-4 p-4"
            >
              <span
                class="mt-0.5 h-fit rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em]"
                :class="SEVERITY_STYLE[finding.severity].chip"
              >
                {{ SEVERITY_STYLE[finding.severity].label }}
              </span>
              <div>
                <div class="mb-1 flex items-baseline justify-between gap-x-3">
                  <span class="font-medium text-zinc-100">{{ finding.title }}</span>
                  <NuxtLink
                    :to="`/tune/${finding.slug}`"
                    class="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-green-400 hover:text-green-300"
                  >
                    {{ finding.slug }} →
                  </NuxtLink>
                </div>
                <p class="mb-1 text-sm text-zinc-400">
                  {{ finding.evidence }}
                </p>
                <p class="text-sm text-zinc-200">
                  <span class="text-green-400">→</span> {{ finding.lever }}
                </p>
              </div>
            </li>
          </ol>
        </section>

        <p class="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600">
          One change at a time · re-record the same laps · compare
        </p>
      </template>
    </template>
  </main>
</template>
