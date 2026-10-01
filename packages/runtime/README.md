# @sleekstack/runtime

The framework-agnostic Effect app runtime that [`@sleekstack/next`](../next) is a preset of. Use it directly to host an Effect app in any server framework.

| Export | What it does |
| --- | --- |
| `configureRuntime({ layer, onError, isControlFlow, id })` | One runtime per process. A config with the same `id` is a no-op (first wins); a different one interrupts in-flight fibers, disposes the old runtime, then builds the new one. |
| `runEffect(effect, { request, overrides, isControlFlow })` | Runs an Effect on the runtime. `request` builds per call; `overrides` shadow both the effect and `request`. |
| `isControlFlow` | Classifies framework control-flow throws (redirects and the like): rethrown untouched, never passed to `onError`. Default: nothing is control flow. |
| `onError(cause, { phase })` | The single sink for defects, finalizer failures and failed builds. Default `console.error`. |
| `getRuntime`, `reportFinalizerFailure`, `RuntimeNotConfigured` | Access and errors. |

```ts
import { Effect } from 'effect'
import { configureRuntime, runEffect } from '@sleekstack/runtime'

configureRuntime({ layer: AppLayer, isControlFlow: (v) => v instanceof Response })
await runEffect(Effect.log('hello'), { request: RequestLayer })
```

`@sleekstack/runtime/internal` is for sibling packages (the devtools buffer) and is not public API.

Guides and the generated API reference live in the docs site ([`apps/docs`](../../apps/docs/README.md)): run `pnpm --filter docs dev` and open http://localhost:3000/docs.
