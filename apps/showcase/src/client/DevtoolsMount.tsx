'use client'
/**
 * apps/showcase/src/client/DevtoolsMount.tsx
 *
 * The devtools panel with the app's atoms. Only ever imported through a dev-guarded dynamic
 * import (app/layout.tsx), so production client chunks never contain it. Atoms are client only, so
 * the counter and the panel's atom list mount after hydration. Its own LayerProvider sits beside
 * (not inside) the demo-mode-keyed one in providers.tsx, so the counter survives the toggle's remount;
 * the panel shows the atoms it is given, not other providers' stores.
 */
import { useEffect, useState } from 'react'
import { LayerProvider, useAtom } from '@sleekstack/react'
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
    <LayerProvider provide={[]}>
      {hydrated && <DemoToggleCounter />}
      <SleekStackDevtools atoms={hydrated ? { demoToggles } : undefined} />
    </LayerProvider>
  )
}
