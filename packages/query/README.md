# @sleekstack/query

Effect-native queries and mutations on the native atom store (ADR 0014). A query is a keyed family of atoms whose read runs an Effect (or Stream): its services are Tags from the query store's scope, its failures are typed, and its cache is disposed with that scope. Depends on `effect` and `@sleekstack/core` only.

| Export | What it does |
| --- | --- |
| `Query` | `make`, `infinite`, `select`, plus `QueryCache` (the registry Tag), `entries`, `observe`, `trigger`, `fetchNext`, `fetchPrevious`. |
| `Queries` | The `Queries` service: `invalidate`, `refetch`, `cancel`, `reset` (by atom or `{ prefix, predicate }`) and `setData`, `updateData`, `getData` (by atom). |
| `Mutation` | `make`, `shared`, `runner`, `optimistic` (an optimistic write with ordered rollback). |
| `Hydrate` | SSR: `hydratable` (a value Schema), `prefetch`, `dehydrate`, `hydrate`, `Dehydrated`. |
| `QueryEvents` | Dev-only client event buffer for the `@sleekstack/devtools` Queries tab. |
| `canonicalKey`, `InvalidQueryKey` | Key canonical form (stable JSON, sorted object keys) and its error. |

```ts
import { Effect, Option, Schedule } from 'effect'
import { Mutation, Query } from '@sleekstack/query'

const todo = Query.make({
  key: (id: string) => ['todo', id],
  fetch: (id) => Effect.flatMap(TodoApi, (api) => api.get(id)),  // R = TodoApi
  staleTime: '30 seconds',
  retry: Schedule.recurs(3),
})

const rename = Mutation.make({
  run: (input: { id: string; title: string }) => Effect.flatMap(TodoApi, (api) => api.rename(input)),
  cancel: (input) => todo(input.id),
  onMutate: (input) => Mutation.optimistic(todo(input.id), (t) => ({ ...Option.getOrThrow(t), title: input.title })),
})
```

React hooks are in `@sleekstack/react`, server `prefetch` in `@sleekstack/next`, and an Effect-free facade (`cachedQuery`, `mutation`) in `@sleekstack/kit`. See the Queries, Queries on the server and TanStack Query mapping guides in [`apps/docs`](../../apps/docs/README.md).
