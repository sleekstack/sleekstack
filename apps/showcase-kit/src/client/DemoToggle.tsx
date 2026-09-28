'use client'
/**
 * apps/showcase-kit/src/client/DemoToggle.tsx
 *
 * R9: the demo-mode toggle. Writes the (non-sensitive, demo-only) cookie
 * directly from the client — no separate override API — then
 * `router.refresh()` re-renders the server tree with the new
 * `isDemoMode()` value, which flows down to `providers.tsx`'s `key` and
 * remounts the app `LayerProvider`, cascading the release of every open
 * component scope (project, task detail) before the new ones acquire.
 */
import { useRouter } from 'next/navigation'
import { DEMO_COOKIE } from '../domain/demo-cookie'

export function DemoToggle({ demoMode }: { readonly demoMode: boolean }) {
  const router = useRouter()

  const toggle = () => {
    document.cookie = demoMode ? `${DEMO_COOKIE}=; path=/; max-age=0` : `${DEMO_COOKIE}=1; path=/`
    router.refresh()
  }

  return (
    <button type="button" onClick={toggle}>
      {demoMode ? 'Exit demo mode' : 'Enter demo mode'}
    </button>
  )
}
