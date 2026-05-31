// Performance class helpers.
//
// Two distinct representations exist:
//   1. The game's CarClass integer (0-7), decoded straight off the telemetry
//      packet — mapped to a letter via CLASS_LETTERS.
//   2. A raw PI number — mapped to a letter via the FH6 class caps. R is a
//      race-car designation, not a PI band, so it is never derived from PI.

/** Game CarClass integer (0-7) → letter. Index is the value Forza reports. */
export const CLASS_LETTERS = ['D', 'C', 'B', 'A', 'S1', 'S2', 'X', 'R'] as const

export type ClassLetter = typeof CLASS_LETTERS[number]

/** Letter for a game-reported CarClass integer (0-7), '?' if out of range. */
export function carClassLetter(c: number): string {
  return CLASS_LETTERS[c] ?? '?'
}

/**
 * FH6 class PI caps (inclusive upper bound per class). X/R are uncapped.
 * Source: upgrade-reference.ts — D 500, C 600, B 700, A 800, S1 900, S2 998.
 */
export const CLASS_PI_CAPS: readonly { letter: ClassLetter, max: number }[] = [
  { letter: 'D', max: 500 },
  { letter: 'C', max: 600 },
  { letter: 'B', max: 700 },
  { letter: 'A', max: 800 },
  { letter: 'S1', max: 900 },
  { letter: 'S2', max: 998 }
] as const

/**
 * Derive the class letter from a PI value using FH6 class caps.
 * Anything above S2's 998 cap is X. Non-finite or non-positive PI returns '?'.
 */
export function classFromPi(pi: number): string {
  if (!Number.isFinite(pi) || pi <= 0) return '?'
  for (const { letter, max } of CLASS_PI_CAPS) {
    if (pi <= max) return letter
  }
  return 'X'
}

/**
 * Class letter for any display that has a PI and (optionally) the game-reported
 * CarClass integer. PI is the source of truth; the game class is the fallback
 * when PI is missing/invalid, and always wins for R (index 7) — a race-car
 * designation with no PI band that classFromPi can never produce.
 */
export function classForDisplay(pi: number | null | undefined, gameClass?: number | null): string {
  if (gameClass === 7) return 'R'
  const fromPi = pi == null ? '?' : classFromPi(pi)
  if (fromPi !== '?') return fromPi
  return gameClass == null ? '?' : carClassLetter(gameClass)
}
