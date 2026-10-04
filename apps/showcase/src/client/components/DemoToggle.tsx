'use client'
/**
 * apps/showcase/src/client/components/DemoToggle.tsx
 *
 * R9: the demo-mode toggle. Writes the (non-sensitive, demo-only) cookie
 * directly from the client — no separate override API — then
 * `router.refresh()` re-renders the server tree with the new
 * `isDemoMode()` value, which flows down to `providers.tsx`'s `key` and
 * remounts the app `LayerProvider`, cascading the release of every open
 * component scope (project, task detail) before the new ones acquire.
 * The remount also discards the old query store, so the cached board is reset
 * rather than invalidated: the refreshed page prefetches the board under the
 * demo overrides and `<HydrationBoundary>` seeds the new store with it. This is
 * a navigation, not a mutation; board mutations never refresh the router.
 */
import { useRouter } from 'next/navigation'
import { DEMO_COOKIE } from '../../domain/demo-cookie'
import { DEMO_TOGGLED } from '../services/app-atoms'

export function DemoToggle({ demoMode }: { readonly demoMode: boolean }) {
  const router = useRouter()

  const toggle = () => {
    document.cookie = demoMode ? `${DEMO_COOKIE}=; path=/; max-age=0` : `${DEMO_COOKIE}=1; path=/`
    window.dispatchEvent(new Event(DEMO_TOGGLED))
    router.refresh()
  }

  return (
    <button type="button" onClick={toggle}>
      {demoMode ? 'Exit demo mode' : 'Enter demo mode'}
    </button>
  )
}
