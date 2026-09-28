/**
 * apps/showcase-kit/src/server/runtime.server.ts
 *
 * Calls `configureRuntime` once, from instrumentation.ts. `runtimeConfig` is a
 * single module-level reference, so a repeat call is a same-reference no-op.
 */
import 'server-only'
import { configureRuntime, query, type RuntimeConfig } from '@sleekstack/kit/next'
import type { FinalizerError } from '@sleekstack/kit'
import { AppModule } from '../domain/modules.server'
import { ActivityLog } from '../domain/tags'

/** Logs and appends to the ActivityLog; never throws out of the sink's caller. */
function onFinalizerError(e: FinalizerError): void {
  console.error('[showcase-kit] finalizer error:', e.message, e.tag ?? '')
  const record = query((log) => () => log.record(`finalizer error: ${e.message}`), [ActivityLog])
  void record().catch((err: unknown) => console.error('[showcase-kit] failed to record finalizer error', err))
}

const runtimeConfig: RuntimeConfig = { provide: [AppModule], onFinalizerError }

configureRuntime(runtimeConfig)
