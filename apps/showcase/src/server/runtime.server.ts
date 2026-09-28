/**
 * apps/showcase/src/server/runtime.server.ts
 *
 * Calls `configureRuntime` once, from `instrumentation.ts`'s nodejs-guarded
 * `register()` (R4). `runtimeConfig` is a single module-level reference, so a
 * repeat call (dev HMR re-running instrumentation) hits the library's
 * same-reference no-op (fn-1 contract).
 */
import 'server-only'
import { configureRuntime, query } from '@sleekstack/next'
import { Cause, Effect } from 'effect'
import { appEntries } from '../domain/modules.server'
import { ActivityLog } from '../domain/tags'

/** Logs to the console and appends to the app's ActivityLog; never throws (asserted by requests.test.ts). */
function onFinalizerError(cause: Cause.Cause<unknown>): void {
  console.error('[showcase] finalizer error:', Cause.pretty(cause))
  const record = query(() =>
    Effect.gen(function* () {
      const activityLog = yield* ActivityLog
      activityLog.record(`finalizer error: ${Cause.pretty(cause)}`)
    }),
  )
  void record().catch((err: unknown) => console.error('[showcase] failed to record finalizer error', err))
}

const runtimeConfig = { provide: appEntries, onFinalizerError }

configureRuntime(runtimeConfig)
