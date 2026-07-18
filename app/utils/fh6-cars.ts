/**
 * FH6 car library — maps a CarOrdinal (the numeric id in the Data Out stream)
 * to a human name, so the UI can show "Maserati Ghibli Cup" instead of
 * "Car #1513".
 *
 * The telemetry only carries the ordinal; the name lives in a lookup table the
 * community extracts from the game files (e.g. HDR's FH6 ordinal gist:
 * https://gist.github.com/HDR/0659d1717bc61504bf83750628963f4f). This seed only
 * holds ordinals we have verified; unknown ones fall back to "Car #<n>". To grow
 * it, add `ordinal: 'Name'` lines — or set the name once in co-driver's garage,
 * which takes priority over this table.
 */

export const FH6_CAR_NAMES: Record<number, string> = {
  1513: 'Maserati Ghibli Cup' // verified from this session's telemetry
}

/** Name for an ordinal, or null when it isn't in the library. */
export function fh6CarName(ordinal: number | null | undefined): string | null {
  if (ordinal == null) return null
  return FH6_CAR_NAMES[ordinal] ?? null
}
