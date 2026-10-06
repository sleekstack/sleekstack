import { Effect, Layer } from 'effect'
import { ProjectNotFound, TaskNotFound, UserNotFound } from '../domain/errors'
import type { Task } from '../domain/model'
import { TaskRepo, UserRepo } from '../domain/ports'
import { projects, tasks, users } from './seed'

const find = <A extends { id: string }, E>(
  xs: ReadonlyArray<A>,
  id: string,
  fail: (id: string) => E,
): Effect.Effect<A, E> => {
  const hit = xs.find((x) => x.id === id)
  return hit ? Effect.succeed(hit) : Effect.fail(fail(id))
}
const noProject = (id: string) => new ProjectNotFound({ id })
const noTask = (id: string) => new TaskNotFound({ id })

export const UserRepoLive = Layer.succeed(UserRepo, {
  all: () => Effect.succeed(users),
  get: (id) => find(users, id, (id) => new UserNotFound({ id })),
})

/** In memory, fresh per build of the layer (so per mount). */
export const TaskRepoLive = Layer.sync(TaskRepo, () => {
  let all = tasks
  let next = tasks.length
  return {
    projects: () => Effect.succeed(projects),
    project: (id) => find(projects, id, noProject),
    byProject: (id) => find(projects, id, noProject).pipe(Effect.map((p) => all.filter((t) => t.projectId === p.id))),
    add: (projectId, { title, priority }) =>
      find(projects, projectId, noProject).pipe(
        Effect.map(() => {
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
      ),
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
