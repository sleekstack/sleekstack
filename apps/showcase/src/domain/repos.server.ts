/**
 * apps/showcase/src/domain/repos.server.ts
 *
 * ProjectRepo, TaskRepo and CommentRepo (R1): `service()` definitions that
 * require the (private) Store plus IdGen/Clock from the Infra module — the
 * dependency edges the graph explorer renders.
 */
import 'server-only'
import { service } from '@sleekstack/core'
import { Effect } from 'effect'
import { Clock, CommentRepo, IdGen, ProjectRepo, Store, TaskRepo } from './tags'

export const SERVER_ONLY_MARKER = 'sleekstack-showcase-server-only-9d7b3e12'

export const ProjectRepoDef = service(ProjectRepo, { requires: [Store] }, ([store]) =>
  Effect.succeed({
    list: () => [...store.projects.values()],
    get: (id: string) => store.projects.get(id),
  }),
)

export const TaskRepoDef = service(TaskRepo, { requires: [Store, IdGen, Clock] }, ([store, idGen, clock]) =>
  Effect.succeed({
    listByProject: (projectId: string) => [...store.tasks.values()].filter((t) => t.projectId === projectId),
    get: (id: string) => store.tasks.get(id),
    create: (input: { readonly projectId: string; readonly title: string }) => {
      const task = {
        id: idGen.next('task'),
        projectId: input.projectId,
        title: input.title,
        status: 'todo' as const,
        createdAt: clock.now(),
      }
      store.tasks.set(task.id, task)
      return task
    },
    move: (id: string, status) => {
      const existing = store.tasks.get(id)
      if (!existing) throw new Error(`Unknown task id: ${id}`)
      const moved = { ...existing, status }
      store.tasks.set(id, moved)
      return moved
    },
  }),
)

export const CommentRepoDef = service(CommentRepo, { requires: [Store, IdGen, Clock] }, ([store, idGen, clock]) =>
  Effect.succeed({
    listByTask: (taskId: string) => [...store.comments.values()].filter((c) => c.taskId === taskId),
    create: (input: { readonly taskId: string; readonly body: string; readonly authorId: string }) => {
      const comment = { id: idGen.next('comment'), createdAt: clock.now(), ...input }
      store.comments.set(comment.id, comment)
      return comment
    },
  }),
)
