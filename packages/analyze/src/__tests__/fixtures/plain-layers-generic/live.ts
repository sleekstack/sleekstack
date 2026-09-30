// Mirrors apps/showcase/src/domain/live.server.ts, which declares its Tags with Context.GenericTag.
import { Effect, Layer } from 'effect'
import { ActivityLog, Clock, IdGen, Store, TaskRepo } from './tags'

const InfraLive = Layer.mergeAll(
  Layer.succeed(Clock, { now: () => 0 }),
  Layer.succeed(IdGen, { next: (p: string) => p }),
)
const StoreLive = Layer.succeed(Store, { rows: new Map() })
const TaskRepoLive = Layer.effect(TaskRepo, Effect.all([Store, IdGen, Clock]).pipe(Effect.map(() => ({ count: () => 0 }))))
const ActivityLogLive = Layer.scoped(ActivityLog, Effect.map(Clock, () => ({ record: () => {} })))

export const AppLive = Layer.mergeAll(TaskRepoLive, ActivityLogLive).pipe(
  Layer.provideMerge(StoreLive),
  Layer.provideMerge(InfraLive),
)
