'use client'
import { Context, Effect, Layer } from 'effect'
import { declareLayer } from '@sleekstack/core'
import { effectFn, QueryClientLive } from '@sleekstack/query'
import { LayerProvider, QueryProvider } from '@sleekstack/react'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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
const provide = [
  declareLayer(
    Layer.succeed(TodoApi, {
      get: (id: string) => Effect.succeed({ id, title: 'Write docs' }),
      rename: () => Effect.void,
    }),
  ),
  // The scope's QueryClient: built with the provider, unmounted and cleared when its scope closes.
  QueryClientLive(),
]

// `effectFn` turns an Effect into a queryFn: its Tags come from the layer that built the client.
const todoOptions = (id: string) =>
  queryOptions({
    queryKey: ['todo', id],
    queryFn: effectFn(Effect.flatMap(TodoApi, (api) => api.get(id))),
    staleTime: 30_000,
  })

function TodoView({ id }: { id: string }) {
  const client = useQueryClient()
  const { data, isPending } = useQuery(todoOptions(id))
  const rename = useMutation({
    // TanStack calls mutationFn as (variables, context); effectFn reads the client from that context.
    mutationFn: (input: { id: string; title: string }, ctx) =>
      effectFn(Effect.flatMap(TodoApi, (api) => api.rename(input)))(input, ctx),
    // Optimistic write, rolled back on error, refetched on settle: plain TanStack.
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: ['todo', input.id] })
      const prev = client.getQueryData(todoOptions(input.id).queryKey)
      if (prev) client.setQueryData(todoOptions(input.id).queryKey, { ...prev, title: input.title })
      return { prev }
    },
    onError: (_e, input, ctx) => client.setQueryData(todoOptions(input.id).queryKey, ctx?.prev),
    onSettled: (_d, _e, input) => client.invalidateQueries({ queryKey: ['todo', input.id] }),
  })
  if (isPending || !data) return <p>Loading</p>
  return <button onClick={() => rename.mutate({ id, title: 'Ship docs' })}>{data.title}</button>
}

export const App = () => (
  <LayerProvider provide={provide}>
    <QueryProvider>
      <TodoView id="t1" />
    </QueryProvider>
  </LayerProvider>
)
