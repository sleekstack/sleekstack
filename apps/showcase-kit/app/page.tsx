/**
 * apps/showcase-kit/app/page.tsx
 *
 * The interactive board. The kit has no server prefetch (ADR 0018), so the client fetches the `board` query
 * (src/client/board-family.ts; its fetch is the `readBoard` Server Action) after hydration.
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
