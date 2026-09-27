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
import { ActivityLog, IdGen } from '../domain/tags'

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
  /** Applies every staged mutation, in order, exactly once (idempotent). */
  readonly commit: Effect.Effect<void>
}

export const UnitOfWork = Context.GenericTag<UnitOfWorkService>('UnitOfWork')

export const UnitOfWorkDef = service(UnitOfWork, { lifetime: 'request' }, () =>
  Effect.sync((): UnitOfWorkService => {
    const staged: Array<() => void> = []
    let committed = false
    return {
      stage: (mutate) => void staged.push(mutate),
      commit: Effect.sync(() => {
        if (committed) return
        committed = true
        for (const mutate of staged) mutate()
      }),
    }
  }),
)
