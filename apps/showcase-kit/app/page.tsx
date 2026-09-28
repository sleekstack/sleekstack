/**
 * apps/showcase-kit/app/page.tsx
 *
 * The interactive board: reads projects/tasks/comments through kit `query()`,
 * with demo-mode Shadowing via per-call `provide`.
 */
import Link from 'next/link'
import { query } from '@sleekstack/kit/next'
import { CommentRepo, ProjectRepo, TaskRepo } from '../src/domain/tags'
import { Board } from '../src/client/Board'
import { demoLayers, isDemoMode } from '../src/server/demo.server'
import { Providers } from './providers'

async function loadBoard() {
  const boardQuery = query((projects, tasks, comments) => () =>
    projects.list().map((project) => ({
      project,
      tasks: tasks.listByProject(project.id).map((task) => ({ task, comments: comments.listByTask(task.id) })),
    })), [ProjectRepo, TaskRepo, CommentRepo], { provide: await demoLayers() })
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
          See <Link href="/log">/log</Link> for the activity log.
        </p>
      </main>
    </Providers>
  )
}
