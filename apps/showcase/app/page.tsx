/**
 * apps/showcase/app/page.tsx
 *
 * The interactive board (R5, R7): resolves the board's Models (`loadBoardModels`)
 * through plain Effect (`runApp`), with demo-mode shadowing (R9) applied via per-call `provide`,
 * then hands the data to the client `Board` (nested `LayerProvider`s,
 * forms wired to the Server Actions in board.actions.ts).
 */
import Link from 'next/link'
import { loadBoardModels } from '../src/models/task.server'
import { Board } from '../src/client/Board'
import { isDemoMode } from '../src/server/demo.server'
import { runApp } from '../src/server/runtime.server'
import { Providers } from './providers'

const loadBoard = () => runApp(loadBoardModels)

export default async function HomePage() {
  // Dev only: a dead branch in production, so the panel's chunk is never emitted.
  const Devtools = process.env.NODE_ENV !== 'production' ? (await import('../src/client/DevtoolsMount')).DevtoolsMount : null
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
      {Devtools && <Devtools />}
    </Providers>
  )
}
