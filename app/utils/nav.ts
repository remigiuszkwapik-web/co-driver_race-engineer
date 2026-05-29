import type { DropdownMenuItem } from '@nuxt/ui'
import type { GameCapabilities } from '#shared/games'

// Single source of truth for the global nav. Used by the default-layout's
// horizontal nav row (desktop) AND its mobile-portrait hamburger
// DropdownMenu, plus the floating hamburger on `/live` (which hides the
// whole header on phone-sized viewports but still needs an escape hatch).
//
// `exact: true` means the active highlight only lights up on an exact
// path match — used for routes like `/live` that have no children we
// want to keep highlighted under. Default is `active-class` behavior
// (highlight stays lit for `/tune/dampers` etc).
//
// Extends `DropdownMenuItem` so the dropdown component still accepts the
// list unchanged; the extra `exact` field is ignored there.

export interface NavItem extends DropdownMenuItem {
  to: string
  label: string
  exact?: boolean
  // Game capability this route needs. Omitted = always shown (telemetry-only
  // routes that work for any game with a wired decoder). Items requiring a
  // capability are hidden when the active game lacks it — see navForGame().
  requires?: keyof GameCapabilities
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Live', to: '/live', exact: true },
  { label: 'Hotlap', to: '/hotlap' },
  { label: 'Dyno', to: '/dyno', requires: 'tuning' },
  { label: 'Garage', to: '/cars', requires: 'tuning' },
  { label: 'Events', to: '/events', requires: 'tuning' },
  { label: 'Tune', to: '/tune', requires: 'tuning' },
  { label: 'Upgrade', to: '/upgrade', requires: 'tuning' },
  { label: 'Manual', to: '/manual', requires: 'tuning' },
  { label: 'Settings', to: '/settings' }
]

/** Nav items visible for a game's capability set: an item shows when it
 *  requires no capability, or the game has the one it requires. */
export function navForGame(capabilities: GameCapabilities): NavItem[] {
  return NAV_ITEMS.filter(item => !item.requires || capabilities[item.requires])
}
