import { Suspense } from 'react'
import { layer, module, tag } from '@sleekstack/kit'
import { LayerProvider, useService, useServices } from '@sleekstack/kit/react'

interface Clock {
  now(): number
}
interface Counter {
  next(): number
}
const Clock = tag<Clock>('Clock')
const Counter = tag<Counter>('Counter')

// Defined once, outside render, so `provide` stays referentially stable.
const appProvide = [module({ name: 'app', provide: [layer(Clock, { now: () => Date.now() })] })]
const panelProvide = [
  layer(
    Counter,
    () => {
      let n = 0
      return { next: () => ++n }
    },
    [],
    { lifetime: 'component' },
  ),
]

function Now() {
  return <time>{useService(Clock).now()}</time>
}

function Panel() {
  const [clock, counter] = useServices([Clock, Counter])
  return (
    <p>
      {counter.next()} at {clock.now()}
    </p>
  )
}

export function App() {
  return (
    <LayerProvider provide={appProvide}>
      <Suspense fallback="Loading">
        <Now />
        {/* A nested provider builds a component scope that closes on unmount. */}
        <LayerProvider provide={panelProvide}>
          <Panel />
        </LayerProvider>
      </Suspense>
    </LayerProvider>
  )
}
