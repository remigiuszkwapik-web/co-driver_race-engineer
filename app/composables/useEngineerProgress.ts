import type { SessionSummary } from '~/utils/engineer-progress'

export interface EngineerProgressResponse {
  car: { ordinal: number, displayName: string | null, class: number | null } | null
  drivetrain: 'fwd' | 'rwd' | 'awd' | null
  current: SessionSummary | null
  previous: SessionSummary | null
}

/**
 * Fetches /api/engineer/progress with the current ?car query param (mirrors
 * useTuneData so the engineer page and this stay on the same car).
 */
export function useEngineerProgress() {
  const route = useRoute()
  const query = computed(() => {
    const q: Record<string, string> = {}
    const car = route.query.car
    if (typeof car === 'string' && car.length > 0) q.car = car
    return q
  })
  return useFetch<EngineerProgressResponse>('/api/engineer/progress', {
    query,
    key: 'engineer-progress'
  })
}
