<script setup lang="ts">
import { UPGRADE_CATEGORIES, MUST_DO_RULES, BUILD_SMELLS } from '~/utils/upgrade-reference'

useHead({ title: 'Upgrade reference · co-driver' })

const topSmells = BUILD_SMELLS.slice(0, 5)
</script>

<template>
  <main class="container mx-auto max-w-6xl px-6 py-10">
    <PageHeader title="What should I install?">
      <template #eyebrow>
        <span>Upgrade reference</span>
        <span class="rounded-sm border border-green-500/40 bg-green-500/10 px-1.5 py-0.5 text-green-300">FH6</span>
      </template>
      <template #intro>
        Every upgrade slot in Forza Horizon 6 — what it actually does, what it
        costs in PI, when it earns its keep, and the traps that quietly burn
        points. Distilled from community guides and updated for FH6's heavier
        slick-on-dirt penalty, first-class front tire width, and the new reality
        that brakes are no longer optional.
      </template>
    </PageHeader>

    <NuxtLink
      to="/upgrade/advisor"
      class="group mb-12 flex items-center justify-between gap-4 card border-l-2 border-l-green-500/60 p-5 transition-colors hover:border-zinc-600 hover:bg-zinc-900/60"
    >
      <div>
        <div class="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-green-400">
          <UIcon
            name="i-lucide-arrow-up-circle"
            class="h-3.5 w-3.5"
          />
          <span>Upgrade Advisor</span>
        </div>
        <div class="font-mono text-lg text-zinc-100">What should I build?</div>
        <p class="text-sm leading-relaxed text-zinc-400">
          Reads your recorded laps, finds what's limiting the car, and tells you
          where to spend PI to max the class.
        </p>
      </div>
      <UIcon
        name="i-lucide-arrow-right"
        class="h-5 w-5 shrink-0 text-zinc-500 group-hover:text-green-300"
      />
    </NuxtLink>

    <section class="mb-12">
      <div class="mb-3 flex items-baseline justify-between">
        <h2 class="font-mono text-xs uppercase tracking-[0.3em] text-zinc-400">
          Must-do rules
        </h2>
        <NuxtLink
          to="/upgrade/homologate"
          class="font-mono text-[10px] uppercase tracking-[0.3em] text-green-400 transition-colors hover:text-green-300"
        >
          Homologate step-by-step →
        </NuxtLink>
      </div>
      <ul class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <li
          v-for="r in MUST_DO_RULES"
          :key="r.rule"
          class="card-subtle p-3"
        >
          <div class="font-mono text-sm text-zinc-100">
            {{ r.rule }}
          </div>
          <div class="mt-1 text-xs leading-relaxed text-zinc-400">
            {{ r.why }}
          </div>
        </li>
      </ul>
    </section>

    <section class="mb-12">
      <div class="mb-3 flex items-baseline justify-between">
        <h2 class="font-mono text-xs uppercase tracking-[0.3em] text-zinc-400">
          By category
        </h2>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="cat in UPGRADE_CATEGORIES"
          :key="cat.slug"
          :to="`/upgrade/${cat.slug}`"
          class="group flex flex-col gap-2 card p-5 transition-colors hover:border-zinc-600 hover:bg-zinc-900/60"
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
          Build smells
        </h2>
        <NuxtLink
          to="/upgrade/homologate"
          class="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          All smells →
        </NuxtLink>
      </div>
      <ul class="space-y-2">
        <li
          v-for="s in topSmells"
          :key="s.smell"
          class="card-warn p-3"
        >
          <div class="flex items-baseline justify-between gap-3">
            <span class="font-mono text-sm text-zinc-200">{{ s.smell }}</span>
            <NuxtLink
              v-if="s.ref"
              :to="`/upgrade/${s.ref}`"
              class="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 transition-colors hover:text-green-300"
            >
              {{ s.ref }} →
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
