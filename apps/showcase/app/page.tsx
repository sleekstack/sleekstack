/**
 * apps/showcase/app/page.tsx
 *
 * The interactive board (R5, R7): resolves the board's Models through delivery's `loadBoard`
 * (`runApp` over the application read), with demo-mode shadowing (R9) applied via per-call `provide`,
 * then hands the data to the client `Board` (nested `LayerProvider`s,
 * forms wired to the Server Actions in delivery/actions.ts).
 */
import Link from 'next/link'
import { Board } from '../src/client/components/Board'
import { isDemoMode } from '../src/delivery/demo-mode'
import { loadBoard } from '../src/delivery/board.server'
import { Providers } from './providers'

export default async function HomePage() {
  const [board, demoMode] = await Promise.all([loadBoard(), isDemoMode()])

  return (
    <Providers demoMode={demoMode}>
      <main>
        <h1>Team Task Board</h1>
        <Board board={board} demoMode={demoMode} />
        <p>
          See <Link href="/log">/log</Link> for the activity log.
        </p>
      </main>
    </Providers>
  )
}
