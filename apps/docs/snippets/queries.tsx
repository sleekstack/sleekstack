'use client'
import { cachedQuery, layer, mutation, tag } from '@sleekstack/kit'
import { LayerProvider, useMutation, useQuery, useQueryClient } from '@sleekstack/kit/react'

interface Todo {
  id: string
  title: string
}
interface Api {
  todo(id: string): Promise<Todo>
  rename(id: string, title: string): Promise<void>
}
const Api = tag<Api>('Api')
const provide = [layer(Api, { todo: async (id: string) => ({ id, title: 'Write docs' }), rename: async () => {} })]

// One cache entry per key. `yield*` resolves a Tag from the nearest LayerProvider; there is no deps array.
const todo = cachedQuery({
  key: (id: string) => ['todo', id],
  fetch: function* (id) {
    const api = yield* Api
    return api.todo(id)
  },
  staleTime: 30_000,
})

const rename = mutation({
  run: function* (input: { id: string; title: string }) {
    const api = yield* Api
    return api.rename(input.id, input.title)
  },
})

function TodoView({ id }: { id: string }) {
  // Does not suspend: check `isPending`. `error` is a SleekStackError.
  const { data, error, isPending, isFetching } = useQuery(todo(id))
  const { mutate, isPending: saving } = useMutation(rename)
  const client = useQueryClient()
  if (isPending) return <p>Loading</p>
  if (!data) return <p>Failed: {error?.code}</p>
  return (
    <p>
      {data.title} {isFetching && '(refreshing)'}
      <button
        disabled={saving}
        onClick={async () => {
          await mutate({ id, title: 'Ship docs' })
          client.invalidate({ prefix: ['todo'] })
        }}
      >
        rename
      </button>
    </p>
  )
}

export const App = () => (
  <LayerProvider provide={provide}>
    <TodoView id="t1" />
  </LayerProvider>
)
