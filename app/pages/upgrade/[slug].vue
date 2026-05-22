<script setup lang="ts">
import {
  findUpgradeCategory,
  UPGRADE_CATEGORIES,
  BUILD_SMELLS,
  DISCIPLINE_LABEL,
  EFFICIENCY_GLYPH,
  EFFICIENCY_LABEL,
  type Discipline,
  type EfficiencyMark
} from '~/utils/upgrade-reference'

const route = useRoute()
const slug = String(route.params.slug ?? '')
const cat = findUpgradeCategory(slug)

if (!cat) {
  throw createError({ statusCode: 404, statusMessage: 'unknown upgrade category' })
}

useHead({ title: `${cat.title} · upgrade reference` })

const DISCIPLINES: Discipline[] = ['road', 'dirt', 'cross-country', 'drift', 'drag']

const hasMatrix = computed(() => cat!.options.some(o => o.matrix))

const relatedCats = computed(() =>
  (cat!.related ?? [])
    .map(s => UPGRADE_CATEGORIES.find(c => c.slug === s))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
)

const relevantSmells = computed(() =>
  BUILD_SMELLS.filter(s => s.ref === cat!.slug)
)

const efficiencyClass: Record<EfficiencyMark, string> = {
  recommend: 'text-green-300',
  situational: 'text-zinc-500',
  avoid: 'text-red-400'
}
</script>

<template>
  <main class="container mx-auto max-w-6xl px-6 py-10">
    <PageHeader :title="cat.title">
      <template #eyebrow>
        <NuxtLink
          to="/upgrade"
          class="hover:text-zinc-300"
        >
          Upgrade reference
        </NuxtLink>
        <span class="text-zinc-700">/</span>
        <span class="text-zinc-300">{{ cat.slug }}</span>
      </template>
      <template #icon>
        <UIcon
          :name="`i-lucide-${cat.icon}`"
          class="h-6 w-6 text-zinc-400"
        />
      </template>
      <template #intro>
        {{ cat.summary }}
      </template>
    </PageHeader>

    <YourDataPanel
      :slug="slug"
      side="upgrade"
    />

    <section class="mb-10">
      <h2 class="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-zinc-400">
        What it does
      </h2>
      <div class="space-y-3 text-sm leading-relaxed text-zinc-300">
        <p
          v-for="(para, i) in cat.what"
          :key="i"
        >
          {{ para }}
        </p>
      </div>
    </section>

    <section class="mb-10">
      <h2 class="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-zinc-400">
        Options
      </h2>
      <div class="space-y-3">
        <div
          v-for="opt in cat.options"
          :key="opt.name"
          class="card p-4"
        >
          <div class="mb-1 flex items-baseline justify-between gap-3">
            <div class="font-mono text-sm text-zinc-100">
              {{ opt.name }}
            </div>
            <div class="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              PI {{ opt.piCost }}
            </div>
          </div>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div class="card-good p-2.5 text-sm">
              <div class="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-green-400/70">
                Best for
              </div>
              <div class="text-zinc-300">
                {{ opt.bestFor }}
              </div>
            </div>
            <div class="card-warn p-2.5 text-sm">
              <div class="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400/70">
                Tradeoff
              </div>
              <div class="text-zinc-300">
                {{ opt.tradeoff }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section
      v-if="hasMatrix"
      class="mb-10"
    >
      <h2 class="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-zinc-400">
        PI-efficiency by discipline
      </h2>
      <div class="overflow-hidden rounded-md border border-zinc-800">
        <table class="w-full font-mono text-sm">
          <thead class="bg-zinc-900/60">
            <tr class="text-left text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              <th class="px-3 py-2 font-normal">
                Option
              </th>
              <th
                v-for="d in DISCIPLINES"
                :key="d"
                class="px-3 py-2 text-center font-normal"
              >
                {{ DISCIPLINE_LABEL[d] }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-800 bg-zinc-900/20">
            <tr
              v-for="opt in cat.options"
              :key="opt.name"
            >
              <td class="px-3 py-2 text-zinc-300">
                {{ opt.name }}
              </td>
              <td
                v-for="d in DISCIPLINES"
                :key="d"
                class="px-3 py-2 text-center"
                :class="opt.matrix ? efficiencyClass[opt.matrix[d]] : 'text-zinc-700'"
                :title="opt.matrix ? EFFICIENCY_LABEL[opt.matrix[d]] : ''"
              >
                <span v-if="opt.matrix">{{ EFFICIENCY_GLYPH[opt.matrix[d]] }}</span>
                <span
                  v-else
                  class="text-zinc-700"
                >·</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="border-t border-zinc-800 bg-zinc-950/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          <span class="text-green-300">●</span> recommend &nbsp;
          <span class="text-zinc-500">○</span> situational &nbsp;
          <span class="text-red-400">✗</span> avoid
        </div>
      </div>
    </section>

    <section class="mb-10">
      <h2 class="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-zinc-400">
        Decision rules
      </h2>
      <ul class="space-y-2">
        <li
          v-for="(r, i) in cat.rules"
          :key="i"
          class="flex gap-3 card-subtle px-3 py-2 text-sm"
        >
          <span class="font-mono text-xs text-zinc-600 tabular-nums">{{ i + 1 }}.</span>
          <span class="text-zinc-200">{{ r }}</span>
        </li>
      </ul>
    </section>

    <section
      v-if="cat.traps && cat.traps.length"
      class="mb-10"
    >
      <h2 class="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-zinc-400">
        Traps
      </h2>
      <div class="space-y-3">
        <div
          v-for="t in cat.traps"
          :key="t.trap"
          class="card-trap p-4"
        >
          <div class="mb-1 font-mono text-sm text-zinc-100">
            {{ t.trap }}
          </div>
          <div class="mb-2 text-sm text-zinc-400">
            <span class="font-mono text-[10px] uppercase tracking-[0.2em] text-red-400/70">Why &nbsp;</span>{{ t.why }}
          </div>
          <div class="text-sm text-green-300">
            <span class="font-mono text-[10px] uppercase tracking-[0.2em] text-green-400/80">Instead &nbsp;</span>{{ t.instead }}
          </div>
        </div>
      </div>
    </section>

    <section
      v-if="relevantSmells.length"
      class="mb-10"
    >
      <h2 class="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-zinc-400">
        Build smells that point here
      </h2>
      <ul class="space-y-2">
        <li
          v-for="s in relevantSmells"
          :key="s.smell"
          class="card-subtle p-3"
        >
          <div class="font-mono text-sm text-zinc-200">
            {{ s.smell }}
          </div>
          <div class="mt-1 text-sm text-zinc-400">
            {{ s.fix }}
          </div>
        </li>
      </ul>
    </section>

    <section
      v-if="cat.tuneRef"
      class="mb-10"
    >
      <h2 class="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-zinc-400">
        After the install — tune it
      </h2>
      <NuxtLink
        :to="`/tune/${cat.tuneRef}`"
        class="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 font-mono text-xs uppercase tracking-[0.2em] text-zinc-300 transition-colors hover:border-green-500/60 hover:text-green-300"
      >
        <UIcon
          name="i-lucide-arrow-right"
          class="h-3 w-3"
        />
        /tune/{{ cat.tuneRef }}
      </NuxtLink>
    </section>

    <section v-if="relatedCats.length">
      <h2 class="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-zinc-400">
        Related
      </h2>
      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-for="r in relatedCats"
          :key="r.slug"
          :to="`/upgrade/${r.slug}`"
          class="rounded-sm border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-300 transition-colors hover:border-green-500/60 hover:text-green-300"
        >
          {{ r.title }}
        </NuxtLink>
      </div>
    </section>
  </main>
</template>
