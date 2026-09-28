'use client'
import { Suspense } from 'react'
import { atom, layer, tag } from '@sleekstack/kit'
import { LayerProvider, useAtom, useAtomValue } from '@sleekstack/kit/react'

interface Api { user(id: number): Promise<string> }
const Api = tag<Api>('Api')
const provide = [layer(Api, { user: async (id: number) => `user ${id}` })]

// Atoms are defined once, at module level. Their state lives in the nearest LayerProvider.
const userId = atom(1)
// Derived: `deps` resolve like `layer`, then `get` reads other atoms and re-runs on change.
const userName = atom((api, get) => api.user(get(userId)), [Api])
// One atom per key; equal keys return the same atom.
const userById = atom.family((id: number, api) => api.user(id), [Api])

function User() {
  const [id, setId] = useAtom(userId)
  return (
    <p>
      {useAtomValue(userName)} / {useAtomValue(userById(id + 1))}
      <button onClick={() => setId((n) => n + 1)}>next</button>
    </p>
  )
}

export const App = () => (
  <LayerProvider provide={provide}>
    {/* Async atoms suspend until their first value; failures reach the error boundary as SleekStackError. */}
    <Suspense fallback="Loading">
      <User />
    </Suspense>
  </LayerProvider>
)
