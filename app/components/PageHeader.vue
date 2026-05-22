<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <header class="mb-8 flex flex-wrap items-end justify-between gap-4">
    <div class="min-w-0">
      <div
        v-if="$slots.eyebrow"
        class="mb-2 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500"
      >
        <slot name="eyebrow" />
      </div>
      <div class="flex items-center gap-3">
        <slot name="icon" />
        <h1 class="font-mono text-3xl text-zinc-100">
          <slot name="title">
            {{ title }}
          </slot>
        </h1>
        <slot name="meta" />
      </div>
      <p
        v-if="$slots.intro"
        class="mt-3 max-w-2xl font-mono text-sm leading-relaxed text-zinc-400"
      >
        <slot name="intro" />
      </p>
    </div>
    <div
      v-if="$slots.actions"
      class="flex items-center gap-2"
    >
      <slot name="actions" />
    </div>
  </header>
</template>
