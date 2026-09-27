/**
 * apps/showcase/src/domain/store.server.ts
 *
 * The in-memory Store (R1): a `service()` definition living at module scope,
 * so it survives across requests (a dev restart resets it — fn-2 non-goal:
 * no real persistence). Seeded once with fixture data. Kept out of Data's
 * `exports` (see modules.server.ts): the graph's one private node — only the
 * repos in this same module talk to it directly.
 */
import 'server-only'
import { service } from '@sleekstack/core'
import { Effect } from 'effect'
import type { CommentRecord, ProjectRecord, StoreService, TaskRecord } from './tags'
import { Store } from './tags'

export const SERVER_ONLY_MARKER = 'sleekstack-showcase-server-only-9d7b3e12'

const seedProjects: readonly ProjectRecord[] = [
  { id: 'proj_1', name: 'SleekStack Launch' },
  { id: 'proj_2', name: 'Docs Overhaul' },
]

const seedTasks: readonly TaskRecord[] = [
  { id: 'task_1', projectId: 'proj_1', title: 'Wire up the graph explorer', status: 'in_progress', createdAt: 1 },
  { id: 'task_2', projectId: 'proj_1', title: 'Ship the error gallery', status: 'todo', createdAt: 2 },
  { id: 'task_3', projectId: 'proj_2', title: 'Write the README', status: 'todo', createdAt: 3 },
]

const seedComments: readonly CommentRecord[] = [
  { id: 'comment_1', taskId: 'task_1', body: 'Looking good so far.', authorId: 'user_1', createdAt: 1 },
]

export const StoreDef = service(Store, {}, () =>
  Effect.sync(
    (): StoreService => ({
      projects: new Map(seedProjects.map((p) => [p.id, p])),
      tasks: new Map(seedTasks.map((t) => [t.id, t])),
      comments: new Map(seedComments.map((c) => [c.id, c])),
    }),
  ),
)
