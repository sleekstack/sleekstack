/**
 * apps/showcase/src/server/runtime.server.ts
 *
 * One ManagedRuntime over `AppLive`, cached on globalThis so dev HMR reuses it.
 * `runApp` runs an Effect with a fresh request scope (RequestLive) and, in demo
 * mode, the mock Layers shadowing the real ones.
 */
import 'server-only'
import { Cause, Effect, Layer, ManagedRuntime } from 'effect'
import { AppLive } from '../domain/live.server'
import { ActivityLog } from '../domain/tags'
import { DemoLive, isDemoMode } from './demo.server'
import { RequestLive } from './request.server'

const g = globalThis as { __showcaseRuntime?: ManagedRuntime.ManagedRuntime<Layer.Layer.Success<typeof AppLive>, never> }
export const runtime = (g.__showcaseRuntime ??= ManagedRuntime.make(AppLive))

/** Logs finalizer/defect causes to the console and the app's ActivityLog; never throws. */
const report = (cause: Cause.Cause<unknown>) =>
  Effect.gen(function* () {
    console.error('[showcase] error:', Cause.pretty(cause))
    const activityLog = yield* ActivityLog
    activityLog.record(`error: ${Cause.pretty(cause)}`)
  }).pipe(Effect.ignore)

export async function runApp<A, E>(
  effect: Effect.Effect<A, E, Layer.Layer.Success<typeof RequestLive> | Layer.Layer.Success<typeof AppLive>>,
): Promise<A> {
  const demo = await isDemoMode()
  return runtime.runPromise(
    effect.pipe(
      Effect.tapDefect(report),
      Effect.provide(RequestLive),
      Effect.provide(demo ? DemoLive : Layer.empty),
    ),
  )
}
