# @sleekstack/next

Effect runtime management for Next.js: the Next preset over [`@sleekstack/runtime`](../runtime).

| Export | What it does |
| --- | --- |
| `configureRuntime({ layer, onError, id })` | Builds one runtime per process, safe across HMR (a config with the same `id` is a no-op). |
| `runEffect(effect, { request, overrides })` | Runs an Effect on that runtime. `request` Layers build per call and are released when it ends; `overrides` shadow services for the effect and `request`. Next control flow (`redirect()`, `notFound()`, ...) is rethrown untouched and never reported. |
| `getRuntime`, `reportFinalizerFailure`, `RuntimeNotConfigured` | Runtime access and errors. `runEffect` before `configureRuntime` rejects with `RuntimeNotConfigured`. |
| `@sleekstack/next/devtools` | Dev-only scope and error buffer behind the [devtools](../devtools) route handler. |

```ts
// instrumentation.ts or a server module
import { Layer } from 'effect'
import { configureRuntime, runEffect } from '@sleekstack/next'

configureRuntime({ layer: AppLayer, onError: (cause, info) => console.error(info.phase, cause) })

// in a server action or route handler
const user = await runEffect(Effect.flatMap(Users, (u) => u.current()), { request: RequestLayer })
```

Action and query sugar (`defineEffect`, `query`, ...) lives in `@sleekstack/kit/next`.

Guides and the generated API reference live in the docs site ([`apps/docs`](../../apps/docs/README.md)): run `pnpm --filter docs dev` and open http://localhost:3000/docs.
