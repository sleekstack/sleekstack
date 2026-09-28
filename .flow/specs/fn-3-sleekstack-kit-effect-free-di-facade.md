# @sleekstack/kit: Effect-free DI facade with Tags, Layers and dependency arrays

## Overview
A new package, `@sleekstack/kit`, with an API that exposes no Effect types. Users write plain async TypeScript: Tags (interfaces or abstract classes) and Layers that implement them, and `useEffect`-style dependency arrays. Effect runs internally: the graph, lifetimes, scopes and tagged errors all come from `@sleekstack/core`, `@sleekstack/next` and `@sleekstack/react`, which stay unchanged.

## Target API (shape)
```ts
export interface Db { query<T>(sql: string, args?: unknown[]): Promise<T[]> }
export const Db = tag<Db>('Db')
export abstract class Users { abstract find(id: string): Promise<User | undefined> }

layer(Db, (config) => { const pool = connect(config.url); return [service, () => pool.end()] }, [Config])
layer(Users, (db) => ({ find: ... }), [Db])
layer(RequestCtx, () => ({ id: crypto.randomUUID() }), [], { lifetime: 'request' })

export const App = module({ provide: [...layers], imports: [Other] })

export const getUser = action((users) => async (id: string) => users.find(id), [Users])
const users = useService(Users)
const [users, clock] = useServices([Users, Clock])
```

## Scope
- New workspace package `packages/kit`, which depends on core, next and react.
- A port of the showcase domain to kit, in `apps/showcase-kit` or a `/kit` route, for side-by-side comparison.

## Boundaries / non-goals
- No changes to the core, next or react public APIs. A blocking bug may be fixed, with a regression test.
- No compiler plugin: parameter-type injection is deferred.
- No `inject()` or Proxy-based wiring. Dependencies are declared only through arrays.
- Dependencies don't re-run when they change: the array declares what to inject, not a reactive subscription.

## Acceptance Criteria
- **R1:** `tag<T>(name)` returns a branded Tag sharing its name with an interface (declaration merging). An abstract class is accepted as a Tag as-is. Both work anywhere a Tag is accepted. Errors: a duplicate Tag name across two Tags raises a descriptive error at graph build.
- **R2:** `layer(tag, impl, deps?, opts?)` takes, as `impl`, a class (constructed with the resolved deps), a factory `(...deps) => T | Promise<T> | [T, cleanup]`, or a plain value. The dependency tuple is typed, so the factory's parameters are inferred and a type mismatch against the Tag is a compile error. `opts.lifetime` is `app|request|component`. Errors: a factory throw or reject surfaces as a descriptive error naming the Tag; a cleanup throw goes to `onFinalizerError` and never changes the result.
- **R3:** `module({ provide, imports, exports? })` maps onto core `module()`, with private Layers when `exports` is given. Graph errors (missing, cycle, captive, ambiguous, module cycle and duplicate) propagate with their messages in plain terms and no Effect types. Errors: every one of the core error cases is reproduced through the kit API in tests.
- **R4:** `action(factory, deps)` and `query(factory, deps)` in `@sleekstack/kit/next`: the factory receives the resolved deps and returns the handler. The exported function's type is exactly the handler's type, with the deps stripped. Request lifetimes follow the core semantics, and there is a per-call `provide` for Shadowing. Errors: a thrown handler error rejects the promise with its message; `fail(msg)` returns an expected failure as `{ok:false,error}`.
- **R5:** `configureRuntime({ modules, onFinalizerError })` works from `instrumentation.ts` with no Effect imports.
- **R6:** In `@sleekstack/kit/react`: `LayerProvider provide={[...]}` wraps core `LayerProvider`; `useService(tag)` and `useServices([tags])` suspend and return plain values; component lifetime and StrictMode keep the core guarantees (1 acquire and 1 release). Errors: a failed acquisition throws to the nearest error boundary.
- **R7:** No public `.d.ts` of `@sleekstack/kit` references `effect` types (asserted by a test that greps the emitted declarations).
- **R8:** The graph stays data: `snapshot(App)` returns the same snapshot shape as core, so `/graph` renders kit apps.
- **R9:** The showcase port reimplements the task board's services, actions and component scopes with kit only (zero `effect` imports in the ported app code, asserted). Its tests mirror the fn-2 request-isolation, rollback and StrictMode tests.
- **R10:** Docs: the package README, an ADR on "dependency arrays over inject/params" with the rejected options (Proxy, `inject()`, and a param-type compiler plugin), and CONTEXT.md terms (Tag via `tag()`, Layer via `layer()`).

## Decision context
- Dependency arrays were picked over `inject()` (implicit, needs an ambient context), a Proxy (misses conditional reads) and param-type injection (needs a compiler plugin).
- The curried `(deps) => (args) =>` keeps the client signature clean without a plugin.
- The `[service, cleanup]` return mirrors useEffect's teardown and is lowered to `acquireRelease`.
