/**
 * apps/showcase/src/server/runtime.server.ts
 *
 * Configures the `@sleekstack/next` runtime over `AppLive` (a module-level call, so a
 * repeat import is a same-reference no-op; the analyzer reads this call as the app root).
 * `runApp` runs an Effect with a fresh request scope (RequestLive) and, in demo mode,
 * the mock Layers shadowing the real ones.
 */
import 'server-only'
import { configureRuntime, runEffect } from '@sleekstack/next'
import { Cause, Effect, type Layer } from 'effect'
import { AppLive } from '../domain/live.server'
import { ActivityLog } from '../domain/tags'
import { DemoLive, isDemoMode } from './demo.server'
import { RequestLive } from './request.server'

// Next loads this module once per server layer (RSC, actions), each with its own config object;
// configures once per process, so a later load never replaces the runtime (restart `next dev` after
// changing AppLive; the adapter's own HMR reconfigure would otherwise fight the second copy).
const g = globalThis as { __showcaseRuntimeConfigured?: boolean }
if (!g.__showcaseRuntimeConfigured) {
  g.__showcaseRuntimeConfigured = true
  configureRuntime({ layer: AppLive })
}

/** Records defect causes in the app's ActivityLog (the runtime's default sink logs to the console); never throws. */
const report = (cause: Cause.Cause<unknown>) =>
  Effect.gen(function* () {
    const activityLog = yield* ActivityLog
    activityLog.record(`error: ${Cause.pretty(cause)}`)
  }).pipe(Effect.ignore)

export async function runApp<A, E>(
  effect: Effect.Effect<A, E, Layer.Layer.Success<typeof RequestLive> | Layer.Layer.Success<typeof AppLive>>,
): Promise<A> {
  const demo = await isDemoMode()
  return runEffect(effect.pipe(Effect.tapDefect(report)), { request: RequestLive, overrides: demo ? DemoLive : undefined })
}
