/**
 * apps/showcase/app/page.tsx
 *
 * Read-only board (R5): reads projects/tasks/comments through `query()`,
 * with demo-mode shadowing (R9) applied via per-call `provide`. The
 * interactive board — nested LayerProviders, forms wired to the Server
 * Actions in board.actions.ts — lands in task .3.
 */
import { query } from '@sleekstack/next'
import { Effect } from 'effect'
import { CommentRepo, ProjectRepo, TaskRepo } from '../src/domain/tags'
import { demoEntries } from '../src/server/demo.server'

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
  const board = await loadBoard()

  return (
    <main>
      <h1>Team Task Board</h1>
      <p>Read-only for now — the interactive board (nested scopes, forms) lands in task .3.</p>
      {board.map(({ project, tasks }) => (
        <section key={project.id}>
          <h2>{project.name}</h2>
          <ul>
            {tasks.map(({ task, comments }) => (
              <li key={task.id}>
                {task.title} — {task.status} ({comments.length} comment{comments.length === 1 ? '' : 's'})
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p>
        See <a href="/log">/log</a> for the activity log, <a href="/graph">/graph</a> for the service graph, and{' '}
        <a href="/errors">/errors</a> for the broken-graph gallery.
      </p>
    </main>
  )
}
