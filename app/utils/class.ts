// Performance class helpers.
//
// Two distinct representations exist:
//   1. The game's CarClass integer (0-7), decoded straight off the telemetry
//      packet — mapped to a letter via CLASS_LETTERS.
//   2. A raw PI number — mapped to a letter via the FH6 class caps. R and X are
//      race-car / extreme designations the game decides, not PI bands, so they
//      are never derived from PI (R can't be; X is a PI-only fallback at >900).

/**
 * Game CarClass integer (0-7) → letter. Index is the value Forza reports.
 * FH6 introduced R as the seventh tier and shifted the order so 6=R, 7=X
 * (older Forza titles topped out at 6=X). The tool targets FH6, so this is the
 * canonical mapping; see issue #22.
 */
export const CLASS_LETTERS = ['D', 'C', 'B', 'A', 'S1', 'S2', 'R', 'X'] as const

export type ClassLetter = typeof CLASS_LETTERS[number]

/** Letter for a game-reported CarClass integer (0-7), '?' if out of range. */
export function carClassLetter(c: number): string {
  return CLASS_LETTERS[c] ?? '?'
}

/**
 * FH6 class PI caps (inclusive upper bound per class). X/R are uncapped.
 * FH6 shifted the bands down one step vs FH4/FH5 — verified in-game (e.g. a
 * 687 PI car reads A, a 734 reads S1): D 400, C 500, B 600, A 700, S1 800,
 * S2 900, X 901+.
 */
export const CLASS_PI_CAPS: readonly { letter: ClassLetter, max: number }[] = [
  { letter: 'D', max: 400 },
  { letter: 'C', max: 500 },
  { letter: 'B', max: 600 },
  { letter: 'A', max: 700 },
  { letter: 'S1', max: 800 },
  { letter: 'S2', max: 900 }
] as const

/**
 * Derive the class letter from a PI value using FH6 class caps.
 * Anything above S2's 900 cap is X. Non-finite or non-positive PI returns '?'.
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
 * CarClass integer. The game class always wins for the top two tiers — R
 * (index 6) is a race-car designation with no PI band that classFromPi can
 * never produce, and X (index 7) is the game's call too. Below those, PI is the
 * source of truth, with the game class as the fallback when PI is missing.
 */
export function classForDisplay(pi: number | null | undefined, gameClass?: number | null): string {
  if (gameClass === 6) return 'R'
  if (gameClass === 7) return 'X'
  const fromPi = pi == null ? '?' : classFromPi(pi)
  if (fromPi !== '?') return fromPi
  return gameClass == null ? '?' : carClassLetter(gameClass)
}
