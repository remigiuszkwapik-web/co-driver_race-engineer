<script setup lang="ts">
import {
  HOMOLOGATION_STEPS,
  BUILD_SMELLS,
  UPGRADE_CATEGORIES
} from '~/utils/upgrade-reference'

useHead({ title: 'Homologate · upgrade reference' })

function catTitle(slug: string): string {
  return UPGRADE_CATEGORIES.find(c => c.slug === slug)?.title ?? slug
}
</script>

<template>
  <main class="mx-auto max-w-4xl px-6 py-10">
    <div class="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
      <NuxtLink
        to="/upgrade"
        class="hover:text-zinc-300"
      >
        Upgrade reference
      </NuxtLink>
      <span class="mx-2 text-zinc-700">/</span>
      <span class="text-zinc-300">Homologate</span>
    </div>
    <h1 class="mb-3 font-mono text-3xl text-zinc-100">
      Homologate a car
    </h1>
    <p class="mb-8 max-w-2xl font-mono text-sm leading-relaxed text-zinc-400">
      The order matters. Each step gates on the previous one — reorder them
      and you waste PI. Walk the list top to bottom for any new build, then
      use the smells table to audit existing builds.
    </p>

    <section class="mb-12">
      <h2 class="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-zinc-400">
        Build order
      </h2>
      <ol class="space-y-3">
        <li
          v-for="(s, i) in HOMOLOGATION_STEPS"
          :key="s.step"
          class="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
        >
          <div class="mb-2 flex items-baseline gap-3">
            <span class="font-mono text-xs text-zinc-600 tabular-nums">{{ String(i + 1).padStart(2, '0') }}</span>
            <h3 class="font-mono text-lg text-zinc-100">
              {{ s.step }}
            </h3>
            <NuxtLink
              v-if="s.ref"
              :to="`/upgrade/${s.ref}`"
              class="ml-auto font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 transition-colors hover:text-green-300"
            >
              {{ s.ref }} →
            </NuxtLink>
          </div>
          <div class="ml-7 space-y-2 text-sm">
            <div class="text-zinc-200">
              <span class="font-mono text-[10px] uppercase tracking-[0.2em] text-green-400/80">Do &nbsp;</span>{{ s.do }}
            </div>
            <div class="text-zinc-400">
              <span class="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Why &nbsp;</span>{{ s.why }}
            </div>
          </div>
        </li>
      </ol>
    </section>

    <section>
      <h2 class="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-zinc-400">
        Build smells (audit existing builds)
      </h2>
      <p class="mb-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
        Spot any of these on a build and you have PI to reallocate. The fix
        column points to the cheapest swap.
      </p>
      <ul class="space-y-2">
        <li
          v-for="s in BUILD_SMELLS"
          :key="s.smell"
          class="rounded-md border border-amber-900/30 bg-amber-950/10 p-3"
        >
          <div class="flex items-baseline justify-between gap-3">
            <span class="font-mono text-sm text-zinc-200">{{ s.smell }}</span>
            <NuxtLink
              v-if="s.ref"
              :to="`/upgrade/${s.ref}`"
              class="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 transition-colors hover:text-green-300"
            >
              {{ catTitle(s.ref) }} →
            </NuxtLink>
          </div>
          <div class="mt-1 text-sm text-zinc-400">
            {{ s.fix }}
          </div>
        </li>
      </ul>
    </section>
  </main>
</template>
