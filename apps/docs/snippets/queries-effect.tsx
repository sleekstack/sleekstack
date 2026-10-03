'use client'
import { Context, Effect, Layer, Option, Schedule } from 'effect'
import { declareLayer } from '@sleekstack/core'
import { Mutation, Query } from '@sleekstack/query'
import { LayerProvider, useMutation, useQuery } from '@sleekstack/react'

interface Todo { readonly id: string; readonly title: string }
class TodoApi extends Context.Tag('TodoApi')<TodoApi, {
  get(id: string): Effect.Effect<Todo>
  rename(input: { id: string; title: string }): Effect.Effect<void>
}>() {}
const provide = [declareLayer(Layer.succeed(TodoApi, {
  get: (id: string) => Effect.succeed({ id, title: 'Write docs' }),
  rename: () => Effect.void,
}))]

// R = TodoApi, resolved from the query store's scope. `retry` re-runs typed failures only.
const todo = Query.make({
  key: (id: string) => ['todo', id],
  fetch: (id) => Effect.flatMap(TodoApi, (api) => api.get(id)),
  staleTime: '30 seconds',
  gcTime: '5 minutes',
  retry: Schedule.recurs(3),
})

const rename = Mutation.make({
  run: (input: { id: string; title: string }) => Effect.flatMap(TodoApi, (api) => api.rename(input)),
  // Cancel an in-flight fetch first, so it cannot overwrite the optimistic write.
  cancel: (input) => todo(input.id),
  // The optimistic write is rolled back if `run` fails or is interrupted.
  onMutate: (input) => Mutation.optimistic(todo(input.id), (t) => ({ ...Option.getOrThrow(t), title: input.title })),
  concurrency: 'switch',
})

function TodoView({ id }: { id: string }) {
  const { data, isPending } = useQuery(todo(id))
  const { mutate } = useMutation(rename)
  if (isPending || !data) return <p>Loading</p>
  return <button onClick={() => mutate({ id, title: 'Ship docs' })}>{data.title}</button>
}

export const App = () => (
  <LayerProvider provide={provide}>
    <TodoView id="t1" />
  </LayerProvider>
)
