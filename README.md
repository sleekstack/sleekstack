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

* Effect TS
* React (as Guests inside `@sleekstack/ui`)
* Vite

---

## Packages

| Package | What it is |
|---------|------------|
| [`@sleekstack/core`](packages/core/README.md) | Effect-native engine: declared Layers, Modules, lifetimes, scopes (the Graph is build-time only) |
| [`@sleekstack/runtime`](packages/runtime/README.md) | Framework-agnostic Effect app runtime (`configureRuntime`, `runEffect`, pluggable control-flow classifier) |
| [`@sleekstack/devtools`](packages/devtools/README.md) | Dev-only panel: graph, scopes, atoms, errors; ui panel: instance tree, atoms per instance, re-runs, effect runs |
| [`@sleekstack/ui`](packages/ui/README.md) | Effect-native components (`Component<P, E, R>`, `Provider`, `Boundary`, `Pending`, `Portal`, `lazy`) with React components as Guests; typed host elements, local state and effects, forms, string, streaming and DOM renderers, hydration and resume. Requirements and errors are checked by `sleekstack check`; demo pages in [`apps/showcase`](apps/showcase/README.md) |
| [`@sleekstack/model`](packages/model/README.md) | Model and Draft for `@sleekstack/ui` (ADR 0038, 0040): `ModelSpec` / `DraftSpec` and `useDraft`, an editable copy of a Model with one save boundary |
| [`@sleekstack/testing`](packages/testing/README.md) | Vitest + jsdom component tests for `@sleekstack/ui`: `render`, `flush`, `mockLayer`, used with Testing Library |
| [`@sleekstack/router`](packages/router/README.md) | Typed routes for `@sleekstack/ui` apps: a const route table, loaders, actions, prefetching `Link`, a server `handle` and a browser `startRouter` |
| [`@sleekstack/start`](packages/start/README.md) | The full-stack layer for `@sleekstack/ui` apps (ADR 0039): a `fetch` entry with middleware and route handlers, server functions with typed client stubs, request services |
| [`@sleekstack/query`](packages/query/README.md) | TanStack Query on Effect Layers (`QueryClientLive`, `effectFn`), with ui hooks in `@sleekstack/query/ui` |
| [`@sleekstack/analyze`](packages/analyze/README.md) | The static Analyzer behind `sleekstack check`: the dependency Graph and the component pass, read through the TypeScript checker |
| [`sleekstack`](packages/cli/README.md) | The CLI: `sleekstack check` and `sleekstack explain <CODE>` |

Planned:

```txt
@sleekstack/rpc
```

---

## Example Direction

```ts
import { Context, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'

class Auth extends Context.Tag('Auth')<Auth, { userId: string }>() {}

// A declared Layer: a plain Effect Layer plus a lifetime.
const AuthDef = declareLayer(Layer.succeed(Auth, { userId: 'u_1' }), { lifetime: 'component' })

const AuthModule = module({ name: 'auth', entries: [AuthDef], exports: [Auth] })
```

---

## Documentation

The docs site lives in [`apps/docs`](apps/docs/README.md): guides plus an API reference generated from TSDoc. Run `pnpm --filter docs dev` and open http://localhost:3000/docs.

---

## Current Status

SleekStack's core engine, runtime and the `@sleekstack/ui` component framework are implemented, with lifetime safety, module shadowing, and a serializable dependency graph in place across `packages/core` and `packages/runtime`.

Current surface:

* Declared Layers (`declareLayer()`) — plain Effect Layers plus a lifetime; the Analyzer reads their Tags from the types
* Modules (`module()`) — imports, exports (private Tags are visible only inside their Module, enforced by `sleekstack check`, ADR 0006), shadowing by position
* lifetime-scoped services (`app` / `request` / `component`) with captive-dependency checks
* a dependency Graph validated at build time by `sleekstack check` (ADR 0011), reported as JSON with `--json`
* `@sleekstack/runtime` runtime management (`configureRuntime`, `runEffect`)

For small worked graphs, see the `sleekstack check` fixtures in [`packages/cli/src/__tests__/fixtures`](packages/cli/src/__tests__/fixtures): `effect-app` (Effect Layers on `@sleekstack/runtime`, with request and overrides roots). [`apps/showcase`](apps/showcase/README.md) is a runnable `@sleekstack/ui` app on Effect Layers; its README lists every demo page and how to run it.
[`apps/realworld`](apps/realworld) is the [RealWorld](https://github.com/realworld-apps/realworld) "Conduit" app built on SleekStack end to end, over `node:sqlite` (ADR 0042); `pnpm --filter realworld dev` runs it.

Still ahead: session/transient/job lifetimes, and stream-aware request-scope finalization.

---

## Long-Term Goal

SleekStack aims to become:

> A unified runtime architecture for full-stack TypeScript applications.

---

## License

MIT

