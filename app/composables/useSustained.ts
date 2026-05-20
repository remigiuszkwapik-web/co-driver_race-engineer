/**
 * Returns a ref that flips true only when `source` has been continuously
 * true for `sustainMs` milliseconds, and flips back to false the instant
 * the source is false. Used to debounce diagnostic chips so transients
 * (a brief slip-ratio blip, a quick suspension compression) don't flash
 * call-outs onto the panels.
 */
export function useSustained(source: () => boolean, sustainMs: number): Ref<boolean> {
  const sustained = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  watch(source, (cond) => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (cond) {
      timer = setTimeout(() => {
        sustained.value = true
        timer = null
      }, sustainMs)
    } else {
      sustained.value = false
    }
  }, { immediate: true })

  if (import.meta.client) {
    onBeforeUnmount(() => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    })
  }

  return sustained
}
