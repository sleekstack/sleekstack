import { Suspense } from 'react'
import { Context, Effect } from 'effect'
import { module, service } from '@sleekstack/core'
import { LayerProvider, useService } from '@sleekstack/react'

class Clock extends Context.Tag('Clock')<Clock, { now(): number }>() {}

const provide = [module({ name: 'app', entries: [service(Clock, {}, () => Effect.succeed({ now: () => Date.now() }))] })]

function Now() {
  return <time>{useService(Clock).now()}</time>
}

export const App = () => (
  <LayerProvider provide={provide}>
    <Suspense fallback="Loading">
      <Now />
    </Suspense>
  </LayerProvider>
)
