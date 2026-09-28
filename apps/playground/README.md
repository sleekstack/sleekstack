# SleekStack Playground

A runnable Vite + React demo of `@sleekstack/core` and `@sleekstack/react`.

## What it shows

- **Tags vs implementations (R11):** `src/tags.ts` holds only Effect Tags
  (`Context.GenericTag`); `src/services.server.ts` holds the Layers. A bundle built from
  `src/client-tags-entry.ts` never contains server implementations
  (`src/__tests__/bundle.test.ts`).
- **Modules:** `module({ name, entries, imports, exports })` in `src/api-example.tsx`.
  `AppModule` imports `HttpModule`, so listing `AppModule` alone provides `HttpClient`.
- **`<LayerProvider provide={[...]}>`:** a top-level provider owns an app scope plus a
  component scope; entries can be service definitions, declared or bare Layers, and modules.
- **`useService(tag)`:** suspends while the scope is acquired, then returns synchronously.
  Wrap consumers (or the provider) in `<Suspense>`; failures reach the nearest error boundary.
- **Nested providers:** the inner provider's `provide` (here `MockHttpClientLayer`) shadows
  the parent's `HttpClient` for its subtree only, and is built over a parent that is still
  acquiring (the Layers use `Effect.sleep`).
- **Cleanup:** `Layer.scoped` finalizers run on unmount, inner providers before outer.

## Minimal usage

```tsx
import { Context, Effect } from 'effect'
import { module, service } from '@sleekstack/core'
import { Suspense } from 'react'
import { LayerProvider, useService } from '@sleekstack/react'

const Logger = Context.GenericTag<{ log(m: string): void }>('Logger')
const Greeter = Context.GenericTag<{ greet(n: string): string }>('Greeter')

const GreeterDef = service(Greeter, { requires: [Logger] }, ([logger]) =>
  Effect.succeed({ greet: (n: string) => (logger.log(n), `Hello, ${n}`) }),
)
const LoggerDef = service(Logger, {}, () => Effect.succeed({ log: console.log }))
const AppModule = module({ name: 'App', entries: [LoggerDef, GreeterDef], exports: [Greeter] })

function Hello() {
  return <p>{useService(Greeter).greet('world')}</p>
}

export const App = () => (
  <LayerProvider provide={[AppModule]}>
    <Suspense fallback="Loading...">
      <Hello />
    </Suspense>
  </LayerProvider>
)
```

A bare `Layer` works as an entry too, but service definitions cannot depend on it; wrap it with
`declareLayer(layer, { provides: [...] })` to make it a graph node.

## Running

```bash
pnpm install                        # pnpm 11 (pinned in packageManager)
pnpm --filter sleekstack-playground dev   # http://localhost:5173
pnpm --filter sleekstack-playground test  # R11 bundle check
```

Open the browser console to see acquisition and `released — scope finalized` logs.

## Files

- `src/tags.ts`: Tags only (client-safe)
- `src/services.server.ts`: Layer implementations
- `src/api-example.tsx`: modules, providers, consumers
- `src/client-tags-entry.ts`: Tag-only bundle entry for the R11 test
- `src/App.tsx`, `src/main.tsx`: entry and Vite bootstrap
