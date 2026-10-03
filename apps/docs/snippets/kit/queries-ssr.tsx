import { cachedQuery, layer, tag } from '@sleekstack/kit'
import { prefetch } from '@sleekstack/kit/next'
import { HydrateQueries, useQuery } from '@sleekstack/kit/react'

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
  serializable: {
    encode: (t: Todo) => ({ ...t, due: t.due.toISOString() }),
    decode: (raw) => {
      const t = raw as Todo & { due: string }
      return { ...t, due: new Date(t.due) }
    },
  },
})

// A client component ('use client' in its own file in a real app).
function TodoTitle({ id }: { id: string }) {
  return <h1>{useQuery(todo(id)).data?.title}</h1>
}

// A server component under the app's LayerProvider. `prefetch` runs on the configured runtime
// (`configureRuntime` from @sleekstack/kit/next); `provide` adds services for this call only.
export default async function Page() {
  const state = await prefetch([todo('t1')], { provide: [ApiLive] })
  return (
    <HydrateQueries state={state}>
      <TodoTitle id="t1" />
    </HydrateQueries>
  )
}
