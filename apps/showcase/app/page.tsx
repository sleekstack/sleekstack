/**
 * apps/showcase/app/page.tsx
 *
 * The interactive board (R5, R7): prefetches the `board` query through `prefetchApp` (the request scope and
 * demo-mode overrides, R9) and hands the dehydrated state to `<HydrationBoundary>` in `Providers`. The client
 * `Board` reads the query cache, which owns every read after that; mutations update it in place.
 */
import Link from 'next/link'
import { Board } from '../src/client/components/Board'
import { boardOptions } from '../src/client/services/board-query'
import { isDemoMode } from '../src/delivery/demo-mode'
import { prefetchApp } from '../src/delivery/runtime.server'
import { Providers } from './providers'

export default async function HomePage() {
  const [state, demoMode] = await Promise.all([prefetchApp([boardOptions]), isDemoMode()])

  return (
    <Providers demoMode={demoMode} state={state}>
      <main>
        <h1>Team Task Board</h1>
        <Board demoMode={demoMode} />
        <p>
          See <Link href="/log">/log</Link> for the activity log.
        </p>
      </main>
    </Providers>
  )
}
