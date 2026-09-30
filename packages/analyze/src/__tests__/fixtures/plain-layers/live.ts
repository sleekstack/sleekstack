// Mirrors apps/showcase/src/domain/live.server.ts.
import { Effect, Layer } from 'effect'
import { ActivityLog, Clock, IdGen, Store, TaskRepo } from './tags'

const InfraLive = Layer.mergeAll(
  Layer.succeed(Clock, { now: () => 0 }),
  Layer.succeed(IdGen, { next: (p: string) => p }),
  Layer.effectDiscard(Effect.void),
)
export const StoreLive = Layer.succeed(Store, {})
const TaskRepoLive = Layer.effect(TaskRepo, Effect.all([Store, IdGen, Clock]).pipe(Effect.map(() => ({}))))
const ActivityLogLive = Layer.scoped(ActivityLog, Effect.map(Clock, () => ({})))

export const AppLive = Layer.mergeAll(TaskRepoLive, ActivityLogLive).pipe(
  Layer.provideMerge(StoreLive),
  Layer.provideMerge(InfraLive),
)
