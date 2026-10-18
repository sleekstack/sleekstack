/** @jsxImportSource @sleekstack/ui */
import { Context, Effect, Layer } from 'effect'
import { effectFn } from '@sleekstack/query'
import { UiQueryClientLive, useMutation, useQuery } from '@sleekstack/query/ui'
import { mount } from '@sleekstack/ui'

interface Todo {
  readonly id: string
  readonly title: string
}
class TodoApi extends Context.Tag('TodoApi')<
  TodoApi,
  {
    get(id: string): Effect.Effect<Todo>
    rename(input: { id: string; title: string }): Effect.Effect<void>
  }
>() {}
const TodoApiLive = Layer.succeed(TodoApi, {
  get: (id: string) => Effect.succeed({ id, title: 'Write docs' }),
  rename: () => Effect.void,
})

// The QueryClient is built over `TodoApiLive`, so `effectFn` queries can use `TodoApi`.
const AppLive = UiQueryClientLive().pipe(Layer.provideMerge(TodoApiLive))

// `effectFn` turns an Effect into a queryFn: its Tags come from the layer that built the client.
const todoOptions = (id: string) => ({
  queryKey: ['todo', id],
  queryFn: effectFn(Effect.flatMap(TodoApi, (api) => api.get(id))),
  staleTime: 30_000,
})

const TodoView = function* ({ id }: { id: string }) {
  const { data, isPending } = yield* useQuery(todoOptions(id))
  const rename = yield* useMutation({
    // TanStack calls mutationFn as (variables, context); effectFn reads the client from that context.
    mutationFn: (input: { id: string; title: string }, ctx) =>
      effectFn(Effect.flatMap(TodoApi, (api) => api.rename(input)))(input, ctx),
  })
  if (isPending || !data) return <p>Loading</p>
  return (
    <button type="button" onClick={() => rename.mutate({ id, title: 'Ship docs' })}>
      {data.title}
    </button>
  )
}

export const start = (container: Element) => mount(<TodoView id="t1" />, { layer: AppLive, container })
