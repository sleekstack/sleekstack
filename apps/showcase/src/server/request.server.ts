/**
 * apps/showcase/src/server/request.server.ts
 *
 * Request-scoped services as plain scoped Layers, built per operation by
 * `Effect.provide(RequestLive)` in runtime.server.ts and released when it ends.
 * RequestContext: a request id plus a fake user; logs open/close to ActivityLog.
 * UnitOfWork: stages writes; actions call `uow.commit` last, so a failure before
 * commit leaves the Store untouched (the finalizer just discards the staged work).
 */
import 'server-only'
import { Context, Effect, Layer } from 'effect'
import { ActivityLog, IdGen, Store, type CommentRecord, type ProjectRecord, type TaskRecord } from '../domain/tags'

export interface RequestUser {
  readonly id: string
  readonly name: string
}

export interface RequestContextService {
  readonly requestId: string
  readonly user: RequestUser
}

export const RequestContext = Context.GenericTag<RequestContextService>('RequestContext')

const FAKE_USER: RequestUser = { id: 'user_1', name: 'Ada Lovelace' }

export const RequestContextLive = Layer.scoped(
  RequestContext,
  Effect.gen(function* () {
    const idGen = yield* IdGen
    const activityLog = yield* ActivityLog
    return yield* Effect.acquireRelease(
      Effect.sync(() => {
        const requestId = idGen.next('req')
        activityLog.record(`request ${requestId} opened`)
        return { requestId, user: FAKE_USER }
      }),
      (rc) => Effect.sync(() => activityLog.record(`request ${rc.requestId} closed`)),
    )
  }),
)

export interface UnitOfWorkService {
  /** Queues a mutation to apply on commit; never runs it eagerly. */
  stage(mutate: () => void): void
  /** Staged mutations not yet committed (the scope finalizer discards them). */
  pending(): number
  /**
   * Applies every staged mutation, in order, exactly once (idempotent), all or
   * nothing: the Store is snapshotted first and restored if any mutation throws.
   */
  readonly commit: Effect.Effect<void>
}

export const UnitOfWork = Context.GenericTag<UnitOfWorkService>('UnitOfWork')

type Snapshot = readonly [Map<string, ProjectRecord>, Map<string, TaskRecord>, Map<string, CommentRecord>]

const restore = <V>(target: Map<string, V>, from: Map<string, V>) => {
  target.clear()
  from.forEach((v, k) => target.set(k, v))
}

// ponytail: activity-log entries written by a rolled-back mutation stay in the log; stage log
// writes separately if that ever matters.
export const UnitOfWorkLive = Layer.scoped(
  UnitOfWork,
  Effect.gen(function* () {
    const store = yield* Store
    const staged: Array<() => void> = []
    let committed = false
    const uow: UnitOfWorkService = {
      stage: (mutate) => void staged.push(mutate),
      pending: () => staged.length,
      commit: Effect.try({
        try: () => {
          if (committed) return
          const snapshot: Snapshot = [new Map(store.projects), new Map(store.tasks), new Map(store.comments)]
          try {
            for (const mutate of staged) mutate()
          } catch (e) {
            restore(store.projects, snapshot[0])
            restore(store.tasks, snapshot[1])
            restore(store.comments, snapshot[2])
            throw e
          }
          committed = true
          staged.length = 0
        },
        catch: (e) => e,
      }).pipe(Effect.orDie),
    }
    // Discards whatever was staged but never committed (a failure before commit, or no commit at all).
    yield* Effect.addFinalizer(() => Effect.sync(() => void (staged.length = 0)))
    return uow
  }),
)

export const RequestLive = Layer.mergeAll(RequestContextLive, UnitOfWorkLive)
