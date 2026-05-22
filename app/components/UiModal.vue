<script setup lang="ts">
const props = withDefaults(defineProps<{
  open: boolean
  size?: 'sm' | 'md' | 'lg'
  dismissible?: boolean
}>(), {
  size: 'md',
  dismissible: true
})

const emit = defineEmits<{
  close: []
}>()

const SIZE_CLASS: Record<NonNullable<typeof props.size>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg'
}

function onBackdrop() {
  if (props.dismissible) emit('close')
}

function onEsc() {
  if (props.dismissible) emit('close')
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 px-4 backdrop-blur-sm"
    @click.self="onBackdrop"
    @keydown.esc.stop="onEsc"
  >
    <div
      class="w-full rounded-md border border-zinc-700 bg-zinc-900 p-6 font-mono"
      :class="SIZE_CLASS[size]"
      role="dialog"
      aria-modal="true"
      @click.stop
    >
      <slot />
    </div>
  </div>
</template>
