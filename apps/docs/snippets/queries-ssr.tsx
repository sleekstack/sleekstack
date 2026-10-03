import { Context, Effect, Layer } from 'effect'
import { prefetchQueries } from '@sleekstack/next'
import { effectFn, QueryClientLive } from '@sleekstack/query'
import { HydrationBoundary, queryOptions, useQuery } from '@tanstack/react-query'

interface Todo { readonly id: string; readonly title: string }
class TodoApi extends Context.Tag('TodoApi')<TodoApi, { get(id: string): Effect.Effect<Todo> }>() {}

export const todoOptions = (id: string) =>
  queryOptions({ queryKey: ['todo', id], queryFn: effectFn(Effect.flatMap(TodoApi, (api) => api.get(id))), staleTime: 30_000 })

// A client component ('use client' in its own file in a real app), under the app's LayerProvider + QueryProvider.
function TodoTitle({ id }: { id: string }) {
  return <h1>{useQuery(todoOptions(id)).data?.title}</h1>
}

// A server component. `prefetchQueries` runs on the configured runtime (`configureRuntime`) with a fresh
// QueryClient from the `request` Layer, and returns TanStack's dehydrated state.
const TodoApiLive = Layer.succeed(TodoApi, { get: (id: string) => Effect.succeed({ id, title: 'Write docs' }) })

export default async function Page() {
  const state = await prefetchQueries([todoOptions('t1')], { request: Layer.merge(TodoApiLive, QueryClientLive()) })
  return (
    <HydrationBoundary state={state}>
      <TodoTitle id="t1" />
    </HydrationBoundary>
  )
}
