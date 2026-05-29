/**
 * Active-game selection. The chosen game drives frontend adaptation — which
 * nav sections show (see NAV_ITEMS capability gating) and any game-specific
 * UI. Persisted to localStorage so the choice survives reloads.
 *
 * The registry (shared/games.ts) is the source of truth; this composable just
 * holds the selection and exposes the strongly-typed current GameDef.
 */

import type { GameId } from '#shared/games'
import { DEFAULT_GAME_ID, GAMES, getGame, isGameId } from '#shared/games'

export function useGame() {
  const gameId = useLocalStorage<GameId>('co-driver:game', DEFAULT_GAME_ID)

  // Guard against a stale/removed id lingering in storage.
  if (!isGameId(gameId.value)) gameId.value = DEFAULT_GAME_ID

  const game = computed(() => getGame(gameId.value))
  const capabilities = computed(() => game.value.capabilities)

  function setGame(id: GameId): void {
    gameId.value = id
  }

  return { gameId, game, capabilities, games: GAMES, setGame }
}
