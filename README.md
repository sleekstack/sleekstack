# SleekStack

A full-stack Effect-native runtime architecture for React and Next.js.

---

## Vision

SleekStack aims to provide:

- structured concurrency
- functional dependency graphs
- request-scoped environments
- deterministic resource ownership
- Suspense-native services
- unified frontend/backend runtime architecture

without:

- decorators
- runtime reflection
- mutable DI containers
- singleton-heavy architecture
- hidden globals

---

## Philosophy

Traditional dependency injection frameworks treat services as:

```txt
Objects created by containers.
```

SleekStack treats services as:

```txt
Managed runtime environments.
```

This enables:

* explicit resource ownership
* request isolation
* deterministic cleanup
* cancellable async systems
* composable service graphs
* runtime introspection

---

## Built On

* React
* Next.js App Router
* Effect TS

---

## Packages

| Package | What it is |
|---------|------------|
| [`@sleekstack/core`](packages/core/README.md) | Effect-native engine: Service Definitions, Modules, lifetimes, the Graph |
| [`@sleekstack/next`](packages/next/README.md) | Next.js request scopes (`action`, `query`) |
| [`@sleekstack/react`](packages/react/README.md) | Suspense-native `LayerProvider` / `useService`, and atoms (`useAtom`, `useAtomValue`) whose state lives per provider |
| [`@sleekstack/kit`](packages/kit/README.md) | Effect-free facade over all three (`tag`, `layer`, `effect`, `module`) |

Planned:

```txt
@sleekstack/rpc
@sleekstack/query
@sleekstack/devtools
@sleekstack/testing
```

---

## Example Direction

```ts
import { Context, Effect } from 'effect'
import { module, service } from '@sleekstack/core'

class Auth extends Context.Tag('Auth')<Auth, { userId: string }>() {}

// A Service Definition: an Effect Layer plus dependency + lifetime metadata.
const AuthDef = service(Auth, { lifetime: 'component' }, () => Effect.succeed({ userId: 'u_1' }))

const AuthModule = module({ name: 'auth', entries: [AuthDef], exports: [Auth] })
```

```tsx
import { LayerProvider, useService } from '@sleekstack/react'

function App() {
  const auth = useService(Auth) // suspends until AuthDef resolves
  return <div>{auth.userId}</div>
}

<LayerProvider provide={[AuthModule]}>
  <App />
</LayerProvider>
```

### With the kit (no Effect types)

```ts
import { effect, layer, module, tag } from '@sleekstack/kit'

interface Clock { now(): number }
const Clock = tag<Clock>('Clock')
const ClockLive = layer(Clock, { now: () => Date.now() })

// A side effect with no service to expose: runs when its scope opens, cleans up when it closes.
const tick = effect((clock) => {
  const t = setInterval(() => console.log(clock.now()), 1_000)
  return () => clearInterval(t)
}, [Clock], { name: 'tick', lifetime: 'app' })

export const AppModule = module({ name: 'app', provide: [ClockLive, tick], exports: [Clock] })
```

---

## Documentation

The docs site lives in [`apps/docs`](apps/docs/README.md): guides plus an API reference generated from TSDoc. Run `pnpm --filter docs dev` and open http://localhost:3000/docs.

---

## Current Status

SleekStack's core engine, Next.js adapter, React adapter and kit facade are implemented, with lifetime safety, module shadowing, and a serializable dependency graph in place across `packages/core`, `packages/next`, and `packages/react`.

Current surface:

* Service Definitions (`service()`) — auto-wired, with readable missing-dependency and cycle errors
* Modules (`module()`) — imports, enforced exports (private Tags are visible only inside their Module, ADR 0006), shadowing
* lifetime-scoped services (`app` / `request` / `component`) with captive-dependency checks
* a dependency Graph validated at build time by `sleekstack check` (ADR 0011), reported as JSON with `--json`
* `@sleekstack/next` request scopes (`action`, `query`) and `@sleekstack/react`'s Suspense-native, StrictMode-safe `LayerProvider` / `useService`

* `@sleekstack/kit` — an Effect-free facade (`tag`, `layer`, `effect`, `module`, deps inferred from `yield*`, one `SleekStackError`); see [`packages/kit`](packages/kit/README.md)

See [`apps/showcase`](apps/showcase/README.md) for a Next.js team task board that exercises all of it end to end, and [`apps/showcase-kit`](apps/showcase-kit/README.md) for the same board built on the kit only.

Still ahead: a devtools UI over the Graph value, session/transient/job lifetimes, and stream-aware request-scope finalization.

---

## Long-Term Goal

SleekStack aims to become:

> A unified runtime architecture for full-stack TypeScript applications.

---

## License

MIT

