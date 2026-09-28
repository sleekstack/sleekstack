/**
 * apps/showcase/src/server/request.server.ts
 *
 * Request-scoped services (R5): RequestContext (a request id from IdGen plus
 * a fake user; logs open/close to ActivityLog) and UnitOfWork (stages writes;
 * the exported Server Actions in board.actions.ts call `uow.commit` as their
 * last step, so a simulated failure that rejects before commit leaves the
 * Store untouched — the scope finalizer then just discards the staged work).
 */
import 'server-only'
import { service } from '@sleekstack/core'
import { Context, Effect } from 'effect'
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

export const RequestContextDef = service(
  RequestContext,
  { requires: [IdGen, ActivityLog], lifetime: 'request' },
  ([idGen, activityLog]) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const requestId = idGen.next('req')
        activityLog.record(`request ${requestId} opened`)
        return { requestId, user: FAKE_USER }
      }),
      (rc) => Effect.sync(() => activityLog.record(`request ${rc.requestId} closed`)),
    ),
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
  readonly commit: Effect.Effect<void, unknown>
}

export const UnitOfWork = Context.GenericTag<UnitOfWorkService>('UnitOfWork')

type Snapshot = readonly [Map<string, ProjectRecord>, Map<string, TaskRecord>, Map<string, CommentRecord>]

const restore = <V>(target: Map<string, V>, from: Map<string, V>) => {
  target.clear()
  from.forEach((v, k) => target.set(k, v))
}

// Requires the private Store to snapshot it, so it lives in the Data module (modules.server.ts).
// ponytail: activity-log entries written by a rolled-back mutation stay in the log; stage log
// writes separately if that ever matters.
export const UnitOfWorkDef = service(UnitOfWork, { requires: [Store], lifetime: 'request' }, ([store]) =>
  Effect.acquireRelease(
    Effect.sync(() => {
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
        }),
      }
      return { uow, staged }
    }),
    // Discards whatever was staged but never committed (a failure before commit, or no commit at all).
    ({ staged }) => Effect.sync(() => void (staged.length = 0)),
  ).pipe(Effect.map(({ uow }) => uow)),
)
