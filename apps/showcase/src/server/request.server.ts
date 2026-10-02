/**
 * apps/showcase/src/server/request.server.ts
 *
 * Request-scoped services as plain scoped Layers, built per operation by
 * `Effect.provide(RequestLive)` in runtime.server.ts and released when it ends.
 * RequestContext: a request id plus a fake user; logs open/close to ActivityLog.
 */
import 'server-only'
import { Context, Effect, Layer } from 'effect'
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

export const RequestLive = RequestContextLive
