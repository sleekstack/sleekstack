import { Effect, Layer } from 'effect'
import { TaskNotFound } from '../domain/errors'
import type { Task } from '../domain/model'
import { TaskRepo } from '../domain/ports'
import { tasks } from './seed'

const find = <A extends { id: string }, E>(
  xs: ReadonlyArray<A>,
  id: string,
  fail: (id: string) => E,
): Effect.Effect<A, E> => {
  const hit = xs.find((x) => x.id === id)
  return hit ? Effect.succeed(hit) : Effect.fail(fail(id))
}
const noTask = (id: string) => new TaskNotFound({ id })

/** In memory, fresh per build of the layer (so per mount). */
export const TaskRepoLive = Layer.sync(TaskRepo, () => {
  let all = tasks
  let next = tasks.length
  return {
    byProject: (projectId) => Effect.succeed(all.filter((t) => t.projectId === projectId)),
    add: (projectId, { title, priority }) =>
      Effect.sync(() => {
        const task: Task = {
          id: `t${++next}`,
          projectId,
          title,
          status: 'todo',
          priority,
          labels: [],
          due: null,
          assigneeId: null,
          votes: 0,
        }
        all = [...all, task]
        return task
      }),
    move: (id, status) =>
      find(all, id, noTask).pipe(
        Effect.map((t) => {
          const moved = { ...t, status }
          all = all.map((x) => (x.id === id ? moved : x))
          return moved
        }),
      ),
    remove: (id) =>
      find(all, id, noTask).pipe(
        Effect.map(() => {
          all = all.filter((x) => x.id !== id)
        }),
      ),
  }
})
