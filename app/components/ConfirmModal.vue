<script setup lang="ts">
const props = withDefaults(defineProps<{
  open: boolean
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  busyLabel?: string
  danger?: boolean
  busy?: boolean
}>(), {
  body: '',
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
  busyLabel: 'Deleting…',
  danger: true,
  busy: false
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': []
  'cancel': []
}>()

function close() {
  if (props.busy) return
  emit('cancel')
  emit('update:open', false)
}

function onConfirm() {
  if (props.busy) return
  emit('confirm')
}
</script>

<template>
  <UiModal
    :open="open"
    :title="title"
    size="md"
    :dismissible="!busy"
    @close="close"
  >
    <h2 class="mb-3 text-lg text-zinc-100">
      {{ title }}
    </h2>

    <div class="mb-5 text-sm text-zinc-400">
      <slot>
        {{ body }}
      </slot>
    </div>

    <div class="flex justify-end gap-2">
      <UButton
        autofocus
        :label="cancelLabel"
        color="neutral"
        variant="outline"
        :disabled="busy"
        class="font-mono text-[11px] uppercase tracking-[0.2em]"
        @click="close"
      />
      <UButton
        :label="busy ? busyLabel : confirmLabel"
        :color="danger ? 'error' : 'primary'"
        variant="subtle"
        :loading="busy"
        :disabled="busy"
        class="font-mono text-[11px] uppercase tracking-[0.2em]"
        @click="onConfirm"
      />
    </div>
  </UiModal>
</template>
