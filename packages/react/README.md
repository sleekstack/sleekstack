# @sleekstack/react

The React adapter for [`@sleekstack/core`](../core): a Suspense-native, StrictMode-safe `LayerProvider` and `useService`.

| Export | What it does |
| --- | --- |
| `LayerProvider` | `provide` takes modules and entries. At the root it builds an app scope; nested under another provider it opens a component scope. Scopes close on unmount. Pass `appScope` to share one externally owned app scope between React roots, and `onFinalizerError` to receive finalizer failures. |
| `useService(Tag)` | Reads a service from the nearest provider. Build failures (for example `MissingDependency`) are thrown to the nearest error boundary. |
| `closeProvidersOn(appScope)` | Closes the providers sharing an external app scope before you close it. |
| `useAtomValue`, `useAtomSet`, `useAtom`, `useAtomRefresh`, `useAtomSuspense` | Atom hooks (client only; they throw `AtomsClientOnly` during a server render). |
| `useQuery`, `useQuerySuspense`, `useQueryResult`, `useInfiniteQuery`, `useQueries`, `useMutation`, `QueryProvider`, `HydrateQueries` | Hooks for [`@sleekstack/query`](../query). Query hooks also work in a server render (they read prefetched data); `useMutation` and `useQueries` are client only. See the Queries guide. |

```tsx
import { Suspense } from 'react'
import { Context, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'
import { LayerProvider, useService } from '@sleekstack/react'

class Clock extends Context.Tag('Clock')<Clock, { now(): number }>() {}
const provide = [module({ name: 'app', entries: [declareLayer(Layer.succeed(Clock, { now: () => Date.now() }), { lifetime: 'component' })] })]

const Now = () => <p>{useService(Clock).now()}</p>
export const App = () => (
  <LayerProvider provide={provide}>
    <Suspense fallback={null}><Now /></Suspense>
  </LayerProvider>
)
```

## Atoms

Atoms (`Atom.make` from `@sleekstack/core`) are reactive client state modeled on effect-atom. Each `LayerProvider` owns an `AtomStore`, so atom state is per provider and is disposed when the provider unmounts, and Effect atoms resolve their services from that provider's scope. See the Atoms guide. In development each provider's store is also listed for the devtools panel through `@sleekstack/react/internal` (not public API; production bundles carry none of it).

Using kit instead of Effect? Use `@sleekstack/kit/react`, which wraps these hooks.

Guides and the generated API reference live in the docs site ([`apps/docs`](../../apps/docs/README.md)): run `pnpm --filter docs dev` and open http://localhost:3000/docs.
