'use client'
/**
 * apps/showcase/src/client/DevtoolsMount.tsx
 *
 * The devtools panel with the app's atoms. Only ever imported through a dev-guarded dynamic
 * import (app/page.tsx), so production client chunks never contain it. Atoms are client only, so
 * the counter and the panel's atom list mount after hydration.
 */
import { useEffect, useState } from 'react'
import { useAtom } from '@sleekstack/react'
import { SleekStackDevtools } from '@sleekstack/devtools'
import { DEMO_TOGGLED, demoToggles } from './app-atoms'

function DemoToggleCounter() {
  const [toggles, setToggles] = useAtom(demoToggles)
  useEffect(() => {
    const onToggle = () => setToggles(toggles + 1)
    window.addEventListener(DEMO_TOGGLED, onToggle)
    return () => window.removeEventListener(DEMO_TOGGLED, onToggle)
  }, [toggles, setToggles])
  return null
}

export function DevtoolsMount() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return (
    <>
      {hydrated && <DemoToggleCounter />}
      <SleekStackDevtools atoms={hydrated ? { demoToggles } : undefined} />
    </>
  )
}
