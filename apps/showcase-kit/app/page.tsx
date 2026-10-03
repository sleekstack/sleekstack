/**
 * apps/showcase-kit/app/page.tsx
 *
 * The interactive board. The client `Board` reads it through the `board` query (src/client/board-query.ts), whose
 * fetch is the `readBoard` Server Action with demo-mode Shadowing via `{ provide: demoLayers }`.
 */
import Link from 'next/link'
import { Board } from '../src/client/Board'
import { isDemoMode } from '../src/server/demo.server'
import { Providers } from './providers'

export default async function HomePage() {
  const demoMode = await isDemoMode()
  return (
    <Providers demoMode={demoMode}>
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
