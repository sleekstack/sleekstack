import { Suspense } from 'react'
import { Context, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'
import { LayerProvider, useService } from '@sleekstack/react'

class Clock extends Context.Tag('Clock')<Clock, { now(): number }>() {}

const provide = [module({ name: 'app', entries: [declareLayer(Layer.succeed(Clock, { now: () => Date.now() }))] })]

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
