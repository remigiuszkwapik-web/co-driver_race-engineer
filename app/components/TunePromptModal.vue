<script setup lang="ts">
const { tunePrompt, clearTunePrompt } = useRecording()

const tuneLabel = ref('')
const saving = ref(false)
const errorMessage = ref<string | null>(null)
const suggestions = ref<string[]>([])

watch(() => tunePrompt.value?.carOrdinal, async (ordinal) => {
  if (!ordinal) {
    suggestions.value = []
    return
  }
  try {
    suggestions.value = await $fetch<string[]>(`/api/cars/${ordinal}/tunes`)
  } catch {
    suggestions.value = []
  }
}, { immediate: true })

watch(() => tunePrompt.value?.sessionId, () => {
  tuneLabel.value = ''
  errorMessage.value = null
})

async function save() {
  const prompt = tunePrompt.value
  if (!prompt) return
  const label = tuneLabel.value.trim()
  if (!label) return
  saving.value = true
  errorMessage.value = null
  try {
    await $fetch(`/api/sessions/${prompt.sessionId}`, {
      method: 'PATCH',
      body: { tuneLabel: label }
    })
    clearTunePrompt()
    tuneLabel.value = ''
  } catch (err) {
    const e = err as { data?: { statusMessage?: string }, statusMessage?: string, message?: string }
    errorMessage.value = e.data?.statusMessage ?? e.statusMessage ?? e.message ?? 'save failed'
  } finally {
    saving.value = false
  }
}

function skip() {
  clearTunePrompt()
  tuneLabel.value = ''
  errorMessage.value = null
}
</script>

<template>
  <UiModal
    :open="!!tunePrompt"
    title="Name this tune?"
    size="md"
    :dismissible="false"
  >
    <div class="mb-1 text-[10px] uppercase tracking-[0.3em] text-zinc-500">
      Tune changed
    </div>
    <h2 class="mb-4 text-xl text-zinc-100">
      Name this tune?
    </h2>
    <p
      v-if="tunePrompt"
      class="mb-4 text-sm text-zinc-400"
    >
      Session #{{ tunePrompt.sessionId }} · car #{{ tunePrompt.carOrdinal }}<br>
      PI {{ tunePrompt.previousPi }} → {{ tunePrompt.currentPi }}
    </p>

    <form
      class="space-y-3"
      @submit.prevent="save"
    >
      <UInput
        v-model="tuneLabel"
        placeholder="e.g. race build v2"
        list="tune-suggestions"
        autofocus
        :disabled="saving"
        class="w-full"
        :ui="{ base: 'text-sm' }"
      />
      <datalist id="tune-suggestions">
        <option
          v-for="s in suggestions"
          :key="s"
          :value="s"
        />
      </datalist>

      <div
        v-if="errorMessage"
        class="text-xs text-red-400"
      >
        {{ errorMessage }}
      </div>

      <div class="flex gap-2">
        <UButton
          type="submit"
          :label="saving ? 'Saving…' : 'Save tune name'"
          color="primary"
          variant="subtle"
          block
          :loading="saving"
          :disabled="saving || !tuneLabel.trim()"
          class="flex-1 font-mono text-[11px] uppercase tracking-[0.2em]"
        />
        <UButton
          label="Skip"
          color="neutral"
          variant="outline"
          :disabled="saving"
          class="font-mono text-[11px] uppercase tracking-[0.2em]"
          @click="skip"
        />
      </div>
    </form>
  </UiModal>
</template>
