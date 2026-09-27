/**
 * apps/showcase/app/page.tsx
 *
 * The interactive board (R5, R7): reads projects/tasks/comments through
 * `query()`, with demo-mode shadowing (R9) applied via per-call `provide`,
 * then hands the data to the client `Board` (nested `LayerProvider`s,
 * forms wired to the Server Actions in board.actions.ts).
 */
import { query } from '@sleekstack/next'
import { Effect } from 'effect'
import { CommentRepo, ProjectRepo, TaskRepo } from '../src/domain/tags'
import { Board } from '../src/client/Board'
import { demoEntries, isDemoMode } from '../src/server/demo.server'
import { Providers } from './providers'

async function loadBoard() {
  const provide = await demoEntries()
  const boardQuery = query({ provide }, () =>
    Effect.gen(function* () {
      const projectRepo = yield* ProjectRepo
      const taskRepo = yield* TaskRepo
      const commentRepo = yield* CommentRepo
      return projectRepo.list().map((project) => ({
        project,
        tasks: taskRepo.listByProject(project.id).map((task) => ({
          task,
          comments: commentRepo.listByTask(task.id),
        })),
      }))
    }),
  )
  return boardQuery()
}

export default async function HomePage() {
  const [board, demoMode] = await Promise.all([loadBoard(), isDemoMode()])

  return (
    <Providers demoMode={demoMode}>
      <main>
        <h1>Team Task Board</h1>
        <Board board={board} demoMode={demoMode} />
        <p>
          See <a href="/log">/log</a> for the activity log, <a href="/graph">/graph</a> for the service graph, and{' '}
          <a href="/errors">/errors</a> for the broken-graph gallery.
        </p>
      </main>
    </Providers>
  )
}
