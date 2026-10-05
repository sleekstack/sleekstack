'use client'
import { Context, Effect, Layer } from 'effect'
import { Atom, Result, declareLayer, module } from '@sleekstack/core'
import { LayerProvider, useAtom, useAtomRefresh, useAtomValue } from '@sleekstack/react'

class Api extends Context.Tag('Api')<Api, { user(id: number): Effect.Effect<string> }>() {}
const provide = [
  module({
    name: 'app',
    entries: [declareLayer(Layer.succeed(Api, { user: (id: number) => Effect.succeed(`user ${id}`) }))],
  }),
]

const userId = Atom.make(1)
// An Effect atom: `Api` resolves from the nearest LayerProvider scope; its value is a Result.
const userName = Atom.make((get) => Effect.flatMap(Api, (api) => api.user(get(userId))))

function User() {
  const [id, setId] = useAtom(userId)
  const refresh = useAtomRefresh(userName)
  const name = Result.match(useAtomValue(userName), {
    onInitial: () => 'Loading',
    onSuccess: (r) => r.value,
    onFailure: () => 'Failed',
  })
  return (
    <p>
      {name}
      <button onClick={() => setId(id + 1)}>next</button>
      <button onClick={refresh}>refresh</button>
    </p>
  )
}

export const App = () => (
  <LayerProvider provide={provide}>
    <User />
  </LayerProvider>
)
