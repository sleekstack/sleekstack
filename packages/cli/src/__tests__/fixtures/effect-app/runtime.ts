import { configureRuntime, runEffect } from '@sleekstack/runtime'
import type { Layer, Effect } from 'effect'
import { AppLive, DemoLive, RequestLive } from './layers'

configureRuntime({ id: 'board', layer: AppLive })

type Services = Layer.Layer.Success<typeof RequestLive> | Layer.Layer.Success<typeof AppLive>

// One request root and one overrides root (the nullish branch is skipped).
export const runApp = <A, E>(effect: Effect.Effect<A, E, Services>, demo: boolean) =>
  runEffect(effect, { request: RequestLive, overrides: demo ? DemoLive : undefined })
