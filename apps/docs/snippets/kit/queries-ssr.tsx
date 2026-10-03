import { cachedQuery, layer, tag } from '@sleekstack/kit'
import { prefetch } from '@sleekstack/kit/next'
import { HydrateQueries, LayerProvider, useQuery } from '@sleekstack/kit/react'
import type { ReactNode } from 'react'

interface Todo { id: string; title: string; due: Date }
interface Api { todo(id: string): Promise<Todo> }
const Api = tag<Api>('Api')
const ApiLive = layer(Api, { todo: async (id: string) => ({ id, title: 'Write docs', due: new Date() }) })

// `serializable` opts the query in to prefetch. `true` sends the value as is (it must be JSON-safe);
// a `Date` is not, so this query passes a plain `{ encode, decode }` codec.
export const todo = cachedQuery({
  key: (id: string) => ['todo', id],
  fetch: function* (id) {
    const api = yield* Api
    return api.todo(id)
  },
  // Hydrated data is fresh until staleTime; with the default 0 the client refetches on mount.
  staleTime: 30_000,
  serializable: {
    encode: (t: Todo) => ({ ...t, due: t.due.toISOString() }),
    decode: (raw) => {
      const t = raw as Todo & { due: string }
      return { ...t, due: new Date(t.due) }
    },
  },
})

// Client components ('use client' in their own file in a real app). The client refetches with its own
// services once the data is stale, so its LayerProvider must provide `Api` too.
function TodoTitle({ id }: { id: string }) {
  return <h1>{useQuery(todo(id)).data?.title}</h1>
}
export const Providers = ({ children }: { children: ReactNode }) => <LayerProvider provide={[ApiLive]}>{children}</LayerProvider>

// A server component. `prefetch` runs on the configured runtime (`configureRuntime` from
// @sleekstack/kit/next); `provide` adds services for this call only.
export default async function Page() {
  const state = await prefetch([todo('t1')], { provide: [ApiLive] })
  return (
    <Providers>
      <HydrateQueries state={state}>
        <TodoTitle id="t1" />
      </HydrateQueries>
    </Providers>
  )
}
