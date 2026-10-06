# @sleekstack/query

The SleekStack bridge over [TanStack Query](https://tanstack.com/query) (ADR 0018). Queries, caching and hooks are TanStack's; this package wires its `QueryClient` to Effect Layers.

| Export | What it does |
| --- | --- |
| `QueryClientTag` | The scope's TanStack `QueryClient`. |
| `QueryClientLive(config?)` | A scoped Layer providing a mounted `QueryClient`, unmounted and cleared when its scope closes. |
| `effectFn(effect)` | Lowers an Effect to a `queryFn` / `mutationFn` run with the services of the client's layer; rejects with the original failure, and an aborted `signal` interrupts it. |

```ts
import { Effect } from 'effect'
import { queryOptions } from '@tanstack/react-query'
import { effectFn } from '@sleekstack/query'

const todo = (id: string) => queryOptions({ queryKey: ['todo', id], queryFn: effectFn(Effect.flatMap(TodoApi, (api) => api.get(id))) })
```

`QueryProvider` is in `@sleekstack/react`, server `prefetchQueries` in `@sleekstack/next`, ui hooks in `@sleekstack/query/ui`, and an Effect-free facade (`cachedQuery`, `mutation`) in `@sleekstack/kit`. See the Queries guides in [`apps/docs`](../../apps/docs/README.md).
