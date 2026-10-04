import { Effect } from 'effect'
import { useMutation, useQuery } from '@sleekstack/ui/query'
import { effectFn, QueryClientTag } from '@sleekstack/query'
import { TaskRepo } from './domain'

// The cache key lives here only: the read and the invalidation after a write cannot drift apart.
const key = (projectId: string) => ['tasks', projectId]

/** The project's tasks through the query cache. */
export const useBacklog = (projectId: string) =>
  useQuery({ queryKey: key(projectId), queryFn: effectFn(TaskRepo.byProject(projectId)) })

/** `mutate(title)` adds a task, then refreshes the backlog. */
export const useAddTask = (projectId: string) =>
  Effect.gen(function* () {
    const client = yield* QueryClientTag
    return yield* useMutation({
      mutationFn: (title: string, ctx) => effectFn(TaskRepo.add(projectId, title))(title, ctx),
      onSuccess: () => client.invalidateQueries({ queryKey: key(projectId) }),
    })
  })
