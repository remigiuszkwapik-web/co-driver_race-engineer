<script setup lang="ts">
const props = withDefaults(defineProps<{
  open: boolean
  size?: 'sm' | 'md' | 'lg'
  dismissible?: boolean
  /** Accessible label for the dialog (visually hidden; consumers render their own heading). */
  title?: string
}>(), {
  size: 'md',
  dismissible: true,
  title: 'Dialog'
})

const emit = defineEmits<{
  close: []
}>()

const SIZE_WIDTH: Record<NonNullable<typeof props.size>, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg'
}

// Bridge UModal's controlled `open`/`update:open` onto the existing `open` + `@close` API.
const open = computed({
  get: () => props.open,
  set: (value) => {
    if (!value) emit('close')
  }
})
</script>

<template>
  <UModal
    v-model:open="open"
    :dismissible="dismissible"
    :title="title"
    :close="false"
    :ui="{
      overlay: 'bg-zinc-950/80 backdrop-blur-sm',
      content: `w-full ${SIZE_WIDTH[size]} rounded-md border border-zinc-700 bg-zinc-900 font-mono ring-0 shadow-xl divide-y-0`,
      header: 'hidden',
      body: 'p-6'
    }"
  >
    <template #body>
      <slot />
    </template>
  </UModal>
</template>
