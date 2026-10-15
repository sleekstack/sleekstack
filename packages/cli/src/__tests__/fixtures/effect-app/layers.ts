// Plain Effect Layers: the app, a scoped per-request layer and demo mocks that Shadow two app services.
import { Effect, Layer } from 'effect'
import { ActivityLog, BoardStore, Clock, IdGen, RequestContext } from './tags'

let seq = 0
const InfraLive = Layer.mergeAll(
  Layer.succeed(Clock, { now: () => Date.now() }),
  Layer.succeed(IdGen, { next: (prefix: string) => `${prefix}_${++seq}` }),
  Layer.effectDiscard(Effect.sync(() => console.log('[Infra] startup'))),
)
const ActivityLogLive = Layer.effect(
  ActivityLog,
  Effect.map(Clock, (clock) => ({ record: (message: string) => console.log(clock.now(), message) })),
)
const BoardStoreLive = Layer.succeed(BoardStore, { tasks: () => Effect.succeed([]) })

export const AppLive = Layer.mergeAll(BoardStoreLive, ActivityLogLive).pipe(Layer.provideMerge(InfraLive))

export const RequestLive = Layer.scoped(
  RequestContext,
  Effect.gen(function* () {
    const idGen = yield* IdGen
    const activityLog = yield* ActivityLog
    return yield* Effect.acquireRelease(
      Effect.sync(() => ({ requestId: idGen.next('req') })),
      (rc) => Effect.sync(() => activityLog.record(`request ${rc.requestId} closed`)),
    )
  }),
)

export const DemoLive = Layer.mergeAll(
  Layer.succeed(ActivityLog, { record: () => {} }),
  Layer.succeed(Clock, { now: () => 0 }),
)
