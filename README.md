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

## Planned Packages

```txt
@sleekstack/core
@sleekstack/react
@sleekstack/next
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

---

## Current Status

SleekStack's core engine, Next.js adapter, and React adapter are implemented, with lifetime safety, module shadowing, and a serializable dependency graph in place across `packages/core`, `packages/next`, and `packages/react`.

Current surface:

* Service Definitions (`service()`) — auto-wired, with readable missing-dependency and cycle errors
* Modules (`module()`) — imports, exports (descriptive graph metadata), shadowing
* lifetime-scoped services (`app` / `request` / `component`) with captive-dependency checks
* a resolved, serializable dependency Graph (`buildGraph`, `snapshot`)
* `@sleekstack/next` request scopes (`action`, `query`) and `@sleekstack/react`'s Suspense-native, StrictMode-safe `LayerProvider` / `useService`

Still ahead: a devtools UI over the Graph value, session/transient/job lifetimes, and stream-aware request-scope finalization.

---

## Long-Term Goal

SleekStack aims to become:

> A unified runtime architecture for full-stack TypeScript applications.

---

## License

MIT

