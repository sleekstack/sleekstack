/**
 * apps/showcase/src/delivery/runtime.server.ts
 *
 * Configures the `@sleekstack/next` runtime over `AppLive` (the composition boundary: the one delivery file allowed to import infrastructure/app.ts; a module-level call, so a
 * repeat import is a same-reference no-op; the analyzer reads this call as the app root).
 * `runApp` runs an Effect with a fresh request scope (RequestLive) and, in demo mode,
 * the mock Layers shadowing the real ones. `prefetchApp` runs page queries the same way for `<HydrationBoundary>`.
 */
import 'server-only'
import { configureRuntime, prefetchQueries, runEffect } from '@sleekstack/next'
import { QueryClientLive } from '@sleekstack/query'
import { Cause, Effect, Layer } from 'effect'
import { AppLive, DemoLive, RequestLive } from '../infrastructure/app'
import { ActivityLog } from '../domain/tags'
import { isDemoMode } from './demo-mode'

// Next loads this module once per server layer (RSC, actions); the shared `id` makes the second copy's
// call a no-op. A dev hot reload of this module (webpack/turbopack `hot.data`) replaces the runtime, so
// the adapter interrupts in-flight calls and disposes the old one.
type Hot = { data?: { reloaded?: boolean }; dispose(cb: (data: { reloaded?: boolean }) => void): void }
const hot = import.meta as { webpackHot?: Hot; turbopackHot?: Hot }
const hotModule = hot.webpackHot ?? hot.turbopackHot
hotModule?.dispose((data) => void (data.reloaded = true))
configureRuntime({ id: 'showcase', layer: AppLive }, { replace: hotModule?.data?.reloaded === true })

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
  return runEffect(effect.pipe(Effect.tapDefect(report)), {
    request: RequestLive,
    overrides: demo ? DemoLive : undefined,
  })
}

/** Prefetches queries with the same request scope and demo overrides as `runApp` (a lazy server read sees neither). */
export async function prefetchApp(queries: Parameters<typeof prefetchQueries>[0]) {
  const demo = await isDemoMode()
  return prefetchQueries(queries, {
    request: Layer.merge(RequestLive, QueryClientLive()),
    overrides: demo ? DemoLive : undefined,
  })
}
