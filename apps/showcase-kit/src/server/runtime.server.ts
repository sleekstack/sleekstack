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

/**
 * Logs and appends to the ActivityLog; never throws out of the sink's caller.
 * Deliberately not demo-Shadowed: this sink also fires on app-scope dispose
 * (no Next request in scope to read the demo cookie from), and a runtime
 * fault is operational, not demo data, so it always belongs in the real log.
 */
function onFinalizerError(e: FinalizerError): void {
  console.error('[showcase-kit] finalizer error:', e.message, e.tag ?? '')
  void query(function* () { ;(yield* ActivityLog).record(`finalizer error: ${e.message}`) }).catch((err: unknown) =>
    console.error('[showcase-kit] failed to record finalizer error', err))
}

const runtimeConfig: RuntimeConfig = { provide: [AppModule], onFinalizerError }

configureRuntime(runtimeConfig)
