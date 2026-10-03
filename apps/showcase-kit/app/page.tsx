/**
 * apps/showcase-kit/app/page.tsx
 *
 * The interactive board. Prefetches the `board` query (src/client/board-family.ts; its fetch is the `readBoard` Server Action
 * with demo-mode Shadowing via `{ provide: demoLayers }`) and hands the state to `<HydrateQueries>` in `Providers`, so
 * the server HTML holds the board and the client does not refetch it. A failed prefetch renders the client-fetch fallback.
 */
import Link from 'next/link'
import { prefetch } from '@sleekstack/kit/next'
import { Board } from '../src/client/Board'
import { board } from '../src/client/board-family'
import { isDemoMode } from '../src/server/demo.server'
import { Providers } from './providers'

export default async function HomePage() {
  const [state, demoMode] = await Promise.all([prefetch([board()]).catch(() => undefined), isDemoMode()])
  return (
    <Providers demoMode={demoMode} state={state}>
      <main>
        <h1>Team Task Board</h1>
        <Board demoMode={demoMode} prefetched={state !== undefined} />
        <p>
          See <Link href="/log">/log</Link> for the activity log.
        </p>
      </main>
    </Providers>
  )
}
