import { Context, Effect, Layer, Schema } from 'effect'
import { prefetch } from '@sleekstack/next'
import { Hydrate, Query } from '@sleekstack/query'
import { HydrateQueries, useQuery } from '@sleekstack/react'

const Todo = Schema.Struct({ id: Schema.String, title: Schema.String })
class TodoApi extends Context.Tag('TodoApi')<TodoApi, { get(id: string): Effect.Effect<typeof Todo.Type> }>() {}

// A query must be hydratable to be prefetched: the Schema encodes its value as plain JSON.
export const todo = Hydrate.hydratable(
  Query.make({ key: (id: string) => ['todo', id], fetch: (id) => Effect.flatMap(TodoApi, (api) => api.get(id)) }),
  { value: Todo },
)

// A client component ('use client' in its own file in a real app).
function TodoTitle({ id }: { id: string }) {
  return <h1>{useQuery(todo(id)).data?.title}</h1>
}

// A server component under the app's LayerProvider: fetch on the server, then seed the client store
// before its first render.
// `prefetch` runs on the configured runtime (`configureRuntime`). Here `TodoApi` comes from a per-call
// `request` Layer; a service from the app Layer needs nothing extra. `{ failures: true }` also sends typed failures.
const TodoApiLive = Layer.succeed(TodoApi, { get: (id: string) => Effect.succeed({ id, title: 'Write docs' }) })

export default async function Page() {
  const state = await prefetch([todo('t1')], { request: TodoApiLive })
  return (
    <HydrateQueries state={state}>
      <TodoTitle id="t1" />
    </HydrateQueries>
  )
}
