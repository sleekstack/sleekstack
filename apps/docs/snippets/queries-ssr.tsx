/** @jsxImportSource @sleekstack/ui */
import { Context, Effect, Layer } from 'effect'
import { effectFn } from '@sleekstack/query'
import { UiQueryClientLive, useSuspenseQuery } from '@sleekstack/query/ui'
import { Pending, hydrateMount, renderToString } from '@sleekstack/ui'

interface Todo {
  readonly id: string
  readonly title: string
}
class TodoApi extends Context.Tag('TodoApi')<TodoApi, { get(id: string): Effect.Effect<Todo> }>() {}

const todoOptions = (id: string) => ({
  queryKey: ['todo', id],
  queryFn: effectFn(Effect.flatMap(TodoApi, (api) => api.get(id))),
  staleTime: 30_000,
})

const TodoTitle = function* ({ id }: { id: string }) {
  const todo = yield* useSuspenseQuery(todoOptions(id))
  return <h1>{todo.title}</h1>
}

const TodoApiLive = Layer.succeed(TodoApi, { get: (id: string) => Effect.succeed({ id, title: 'Write docs' }) })
const layer = UiQueryClientLive().pipe(Layer.provideMerge(TodoApiLive))
const page = (
  <Pending fallback={<p>Loading</p>}>
    <TodoTitle id="t1" />
  </Pending>
)

// Server: renderToString waits for the query and writes the cache into the page's `data-sleek-hydrate` script.
export const html = () => renderToString(page, { layer })

// Client: hydrateMount seeds the QueryClient from that script, so the first render does not fetch again.
export const hydrate = (container: Element) => hydrateMount(page, { layer, container })
