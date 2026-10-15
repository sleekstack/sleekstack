import { configureRuntime, prefetchQueries, runEffect } from '@sleekstack/next'
import { QueryClientLive } from '@sleekstack/query'
import { Layer, type Effect } from 'effect'
import { AppLive, DemoLive, RequestLive } from './layers'

configureRuntime({ id: 'board', layer: AppLive })

type Services = Layer.Layer.Success<typeof RequestLive> | Layer.Layer.Success<typeof AppLive>

// One request root and one overrides root (the nullish branch is skipped).
export const runApp = <A, E>(effect: Effect.Effect<A, E, Services>, demo: boolean) =>
  runEffect(effect, { request: RequestLive, overrides: demo ? DemoLive : undefined })

// prefetchQueries is not a runEffect call: it adds no root.
export const prefetchApp = (queries: Parameters<typeof prefetchQueries>[0], demo: boolean) =>
  prefetchQueries(queries, {
    request: Layer.merge(RequestLive, QueryClientLive()),
    overrides: demo ? DemoLive : undefined,
  })
