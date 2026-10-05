/**
 * apps/showcase-kit/src/server/request.server.ts
 *
 * Request-lifetime services: RequestContext (request id + fake user; logs
 * open/close) and UnitOfWork (stages writes; actions call `commit()` last, so
 * a failure before commit leaves the Store untouched and the cleanup discards
 * the staged work).
 */
import 'server-only'
import { layer, tag, withCleanup } from '@sleekstack/kit'
import { ActivityLog, IdGen, Store } from '../domain/tags'

export interface RequestContextService {
  readonly requestId: string
  readonly user: { readonly id: string; readonly name: string }
}

export const RequestContext = tag<RequestContextService>('RequestContext')

export const RequestContextLayer = layer(
  RequestContext,
  (idGen, activityLog) => {
    const requestId = idGen.next('req')
    activityLog.record(`request ${requestId} opened`)
    return withCleanup({ requestId, user: { id: 'user_1', name: 'Ada Lovelace' } }, () =>
      activityLog.record(`request ${requestId} closed`),
    )
  },
  [IdGen, ActivityLog],
  { lifetime: 'request' },
)

export interface UnitOfWorkService {
  /** Queues a mutation to apply on commit; never runs it eagerly. */
  stage(mutate: () => void): void
  /** Staged mutations not yet committed (cleanup discards them). */
  pending(): number
  /** Applies every staged mutation once, all or nothing (Store restored if one throws). */
  commit(): void
}

export const UnitOfWork = tag<UnitOfWorkService>('UnitOfWork')

const restore = <V>(target: Map<string, V>, from: Map<string, V>) => {
  target.clear()
  from.forEach((v, k) => target.set(k, v))
}

// Requires the private Store, so it lives in the Data module.
// ponytail: activity entries from a rolled-back mutation stay in the log.
export const UnitOfWorkLayer = layer(
  UnitOfWork,
  (store) => {
    const staged: Array<() => void> = []
    let committed = false
    const uow: UnitOfWorkService = {
      stage: (mutate) => void staged.push(mutate),
      pending: () => staged.length,
      commit: () => {
        if (committed) return
        const snap = [new Map(store.projects), new Map(store.tasks), new Map(store.comments)] as const
        try {
          for (const mutate of staged) mutate()
        } catch (e) {
          restore(store.projects, snap[0])
          restore(store.tasks, snap[1])
          restore(store.comments, snap[2])
          throw e
        }
        committed = true
        staged.length = 0
      },
    }
    return withCleanup(uow, () => void (staged.length = 0))
  },
  [Store],
  { lifetime: 'request' },
)
