import { Effect } from 'effect'
import { useMutation, useSuspenseQuery } from '@sleekstack/ui/query'
import { effectFn, QueryClientTag } from '@sleekstack/query'
import { TaskRepo, type NewTask, type Status } from './domain'

export type { QueryFailed } from '@sleekstack/ui/query'

// The cache key lives here only: the read and the invalidation after a write cannot drift apart.
const key = (projectId: string) => ['tasks', projectId]

/** A project's tasks for a component under `Pending`: suspends until the first result, fails with `QueryFailed`. */
export const useSuspenseTasks = (projectId: string) =>
  useSuspenseQuery({ queryKey: key(projectId), queryFn: effectFn(TaskRepo.byProject(projectId)) })

/** Every write refreshes the project's tasks, so the board, the triage list and the detail panel follow it. */
export const useTaskActions = (projectId: string) =>
  Effect.gen(function* () {
    const client = yield* QueryClientTag
    const onSuccess = () => client.invalidateQueries({ queryKey: key(projectId) })
    const add = yield* useMutation({
      mutationFn: (task: NewTask, ctx) => effectFn(TaskRepo.add(projectId, task))(task, ctx),
      onSuccess,
    })
    const move = yield* useMutation({
      mutationFn: (v: { id: string; status: Status }, ctx) => effectFn(TaskRepo.move(v.id, v.status))(v, ctx),
      onSuccess,
    })
    const remove = yield* useMutation({
      mutationFn: (id: string, ctx) => effectFn(TaskRepo.remove(id))(id, ctx),
      onSuccess,
    })
    return { add, move, remove }
  })
