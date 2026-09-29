/**
 * apps/showcase-kit/app/page.tsx
 *
 * The interactive board: reads projects/tasks/comments through kit `query`,
 * with demo-mode Shadowing via `{ provide: demoLayers }` (see ../src/server/demo.server.ts).
 */
import Link from 'next/link'
import { query } from '@sleekstack/kit/next'
import { CommentRepo, ProjectRepo, TaskRepo } from '../src/domain/tags'
import { Board } from '../src/client/Board'
import { demoLayers, isDemoMode } from '../src/server/demo.server'
import { Providers } from './providers'

export default async function HomePage() {
  const [board, demoMode] = await Promise.all([
    query(function* () {
      const projects = yield* ProjectRepo
      const tasks = yield* TaskRepo
      const comments = yield* CommentRepo
      return projects.list().map((project) => ({
        project,
        tasks: tasks.listByProject(project.id).map((task) => ({ task, comments: comments.listByTask(task.id) })),
      }))
    }, [ProjectRepo, TaskRepo, CommentRepo], { provide: demoLayers }),
    isDemoMode(),
  ])
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
