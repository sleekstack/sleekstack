/**
 * apps/showcase/app/page.tsx
 *
 * The interactive board (R5, R7): resolves the board's Models (`loadBoard`)
 * through plain Effect (`runApp`), with demo-mode shadowing (R9) applied via per-call `provide`,
 * then hands the data to the client `Board` (nested `LayerProvider`s,
 * forms wired to the Server Actions in board.actions.ts).
 */
import Link from 'next/link'
import { loadBoard as loadBoardView } from '../src/application/board-view'
import { Board } from '../src/client/Board'
import { isDemoMode } from '../src/server/demo.server'
import { runApp } from '../src/server/runtime.server'
import { Providers } from './providers'

const loadBoard = () => runApp(loadBoardView)

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
