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
      <input
        v-model="tuneLabel"
        type="text"
        placeholder="e.g. race build v2"
        list="tune-suggestions"
        autofocus
        :disabled="saving"
        class="w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
      >
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
        <button
          type="submit"
          :disabled="saving || !tuneLabel.trim()"
          class="flex-1 rounded-sm border border-green-500/40 bg-green-500/10 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-green-300 transition-colors hover:border-green-400/60 hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {{ saving ? 'Saving…' : 'Save tune name' }}
        </button>
        <button
          type="button"
          :disabled="saving"
          class="rounded-sm border border-zinc-700 bg-zinc-900 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          @click="skip"
        >
          Skip
        </button>
      </div>
    </form>
  </UiModal>
</template>
