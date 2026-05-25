<script setup lang="ts">
// Reusable section block for /manual/* pages — title + where + intro,
// then three optional structural slots: "how" (axes / colors / legend),
// "shapes" (table of shape → interpretation), "seeAlso" (links). Keeps
// every manual page consistent without each one re-doing the markup.

defineProps<{
  id: string
  title: string
  where: string
}>()
</script>

<template>
  <section
    :id="id"
    class="mb-12 scroll-mt-20"
  >
    <h2 class="mb-1 font-mono text-lg text-zinc-100">
      {{ title }}
    </h2>
    <div class="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
      {{ where }}
    </div>

    <div class="space-y-4 text-sm leading-relaxed text-zinc-300">
      <slot name="intro" />

      <div
        v-if="$slots.how"
        class="card p-4"
      >
        <div class="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          How to read it
        </div>
        <slot name="how" />
      </div>

      <div
        v-if="$slots.shapes"
        class="card p-4"
      >
        <div class="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          Reading the shape
        </div>
        <slot name="shapes" />
      </div>

      <div
        v-if="$slots.seeAlso"
        class="card-subtle p-3 text-zinc-400"
      >
        <span class="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">See also</span>
        <span class="ml-2">
          <slot name="seeAlso" />
        </span>
      </div>
    </div>
  </section>
</template>
