# @sleekstack/kit: Effect-free DI facade with Tags, Layers and dependency arrays

## Overview
A new package, `@sleekstack/kit`, with an API that exposes no Effect types. Users write plain async TypeScript: Tags (interfaces or abstract classes), Layers that implement them, and `useEffect`-style dependency arrays. Effect runs internally: the graph, lifetimes, scopes and tagged errors all come from `@sleekstack/core`, `@sleekstack/next` and `@sleekstack/react`, which stay unchanged. Kit is a lowering layer: every kit construct compiles to an existing core, next or react construct, and never reimplements scope, request or StrictMode logic.

## Target API (shape)
```ts
export interface Db { query<T>(sql: string, args?: unknown[]): Promise<T[]> }
export const Db = tag<Db>('Db')
export abstract class Users { abstract find(id: string): Promise<User | undefined> }

layer(Db, (config) => { const pool = connect(config.url); return withCleanup(service, () => pool.end()) }, [Config])
layer(Users, (db) => ({ find: ... }), [Db])
layer(RequestCtx, () => ({ id: crypto.randomUUID() }), [], { lifetime: 'request' })

export const App = module({ name: 'App', provide: [...layers], imports: [Other] })

export const getUser = action((users) => async (id: string) => users.find(id), [Users])
const users = useService(Users)
const [users, clock] = useServices([Users, Clock])
```

## Quick commands
```bash
pnpm --filter @sleekstack/kit typecheck
pnpm --filter @sleekstack/kit test
pnpm --filter @sleekstack/kit build:types   # emits .d.ts for the R7 check
```

## Scope
- New workspace package `packages/kit`, with subpath entries `@sleekstack/kit`, `@sleekstack/kit/next` and `@sleekstack/kit/react` (the first package with an `exports` map). It depends on core, next and react.
- A declaration-emit step for kit only (the other packages keep pointing `main` at `src`).
- A port of the showcase domain to kit, as `apps/showcase-kit`.
- CI: add kit and showcase-kit to the script-presence loop, plus the declaration-emit check.

## Boundaries / non-goals
- No changes to the core, next or react public APIs. A blocking bug may be fixed, with a regression test.
- No compiler plugin: parameter-type injection is deferred.
- No `inject()`, no ambient context, and no Proxy-based wiring. Dependencies are declared only through arrays.
- Dependencies don't re-run when they change: the array declares what to inject, not a reactive subscription.
- No streaming results from actions or queries (inherited from next; they reject, as documented).
- No `useServices` or other new primitive in `@sleekstack/react`. `useServices` is kit-level code built on the public `useService`.

## Decision context
- Dependency arrays were picked over `inject()` (implicit, needs an ambient context), a Proxy (misses conditional reads) and param-type injection (needs a compiler plugin).
- The curried `(deps) => (args) =>` keeps the client signature clean without a plugin.
- **Cleanup uses the branded `withCleanup(service, fn)` instead of a `[service, cleanup]` tuple.** A tuple is ambiguous when the service itself is an array. `withCleanup` is lowered to `acquireRelease`.
- **`module()` requires `name`**, mirroring core, which throws `InvalidModule` on a missing name. Names feed the graph snapshot and error messages. Auto-generated names were rejected because they make errors unreadable.
- **Tag identity:** `tag<T>(name)` creates one core Tag per call. An abstract class is mapped to a core Tag through a module-level `WeakMap` keyed by class reference, with the class name as the key. Two distinct Tags sharing a key are detected when a graph is built (per `buildGraph`, never a process-global registry, so tests and HMR stay isolated).
- **Action seam:** kit `action`/`query` lower to next's `action`/`query`. The lowered operation resolves the dep Tags from the request context, calls `factory(...deps)`, then runs the handler inside a promise-to-Effect adapter. Request scope, per-call `provide`, finalizer-error sink and the stream guard all stay next's. The adapter is internal, and no Effect type appears in kit's exported signatures.
- **Failure channels:** kit actions always resolve to `ActionResult<T> = {ok:true,data} | {ok:false,error}`. `fail(msg)` produces the `{ok:false}` branch. Any other throw is unexpected: it rejects, so it reaches `error.tsx`. This matches the fn-2 showcase pattern, because Next masks thrown messages in production. Queries return the plain value, and a `fail` inside a query rejects with its message.
- **React:** `layer()` returns a core Entry, so kit's `LayerProvider` is core's `LayerProvider` re-exported. `provide` stays referentially stable under the same rules as core, and the StrictMode park/adopt logic is untouched. `useServices(tags)` calls `useService` once per Tag; the array length must stay constant across renders, which is checked in dev.
- **Errors:** core's tagged graph errors are rethrown as a kit `SleekStackError extends Error` with `.code` (e.g. `'MissingDependency'`), `.message` and structured `.details` (Tag names, cycle path). The Effect error classes are never exported.
- **`configureRuntime`:** passes through to next's, keeping the same-reference no-op on a repeat call (dev HMR).
- **Showcase dependency:** the port reads `apps/showcase`, which lands with fn-2 (PR #2). That task waits for PR #2 to merge.

## Acceptance Criteria
- **R1:** `tag<T>(name)` returns a branded Tag that shares its name with an interface (declaration merging; the interface and the const are exported together). An abstract class is accepted as a Tag as-is, through an `abstract new (...args: any) => T` token type. Both work anywhere a Tag is accepted. Errors: an empty or non-string name throws at `tag()`; two distinct Tags with the same key raise `SleekStackError` code `DuplicateTag` when the graph builds; the same abstract class used twice maps to the same Tag.
- **R2:** `layer(tag, impl, deps?, opts?)` takes, as `impl`, a class (constructed with the resolved deps as constructor args), a factory `(...deps) => T | Promise<T> | Cleanup<T>`, or a plain value. The dependency tuple is typed, so the factory's parameters are inferred, and a return type that doesn't match the Tag is a compile error (asserted in `.test-d.ts`). `opts.lifetime` is `app|request|component`. Errors: a factory throw or reject surfaces as `SleekStackError` code `LayerFailed`, naming the Tag; a cleanup throw goes to `onFinalizerError` and never changes the result; an array-shaped service is returned unchanged (no tuple sniffing).
- **R3:** `module({ name, provide, imports?, exports? })` maps onto core `module()`, with private Layers when `exports` is given. Graph errors (missing, cycle, captive, ambiguous, module cycle, duplicate module, invalid module) surface as `SleekStackError` with the core `.code` and message. Errors: every one of the core error cases is reproduced through the kit API in tests; a missing `name` throws `InvalidModule`.
- **R4:** `action(factory, deps, opts?)` and `query(factory, deps, opts?)` in `@sleekstack/kit/next`: the factory receives the resolved deps and returns the handler. The exported function's parameters are exactly the handler's, with the deps stripped. It is an async function, so it's valid as an export of a `'use server'` file. Request lifetimes follow the core semantics; `opts.provide` does per-call Shadowing. Errors: `fail(msg)` resolves `{ok:false,error:msg}`; any other throw rejects; a streaming return rejects (next's guard); a dependency missing from the graph rejects with `MissingDependency`.
- **R5:** `configureRuntime({ provide, onFinalizerError? })` in `@sleekstack/kit/next` works from `instrumentation.ts` with no Effect imports, and a repeat call with the same config is a no-op. Errors: calling `action` before `configureRuntime` rejects with next's "runtime not configured" message.
- **R6:** In `@sleekstack/kit/react`: `LayerProvider` (core's, re-exported), `useService(tag)` and `useServices([tags])` suspend and return plain values; component lifetime and StrictMode keep the core guarantees (1 acquire and 1 release per real mount). Errors: a failed acquisition throws to the nearest error boundary; a change of `useServices` array length warns in dev.
- **R7:** No emitted `.d.ts` of `@sleekstack/kit` (any subpath) references `effect`. A test runs the declaration emit and greps its output. Errors: the test fails if `effect` appears, or if no `.d.ts` was emitted (vacuous pass).
- **R8:** `snapshot(App)` returns core's snapshot shape unchanged, so the fn-2 `/graph` page renders kit apps. Errors: no error surface beyond R3.
- **R9:** `apps/showcase-kit` reimplements the task board's services, actions and component scopes with kit only. Zero `effect` imports in its app code, asserted by a test. Its tests mirror fn-2's request isolation (20 concurrent calls), rollback and StrictMode tests. Errors: the simulated failure resolves `{ok:false}` and leaves the store unchanged.
- **R10:** Docs: `packages/kit/README.md`; ADR 0005 "dependency arrays over inject/params" with the rejected options; CONTEXT.md gains a kit section, `tag()`/`layer()` in canonical style; the root README lists kit; CI runs kit's and showcase-kit's test, typecheck and declaration check. Errors: n/a.

## Early proof point
Task .1 proves the lowering: `tag`, `layer` (factory, class, value, async, `withCleanup`) and `module` build a real core graph, deps typing infers from a trailing array, and the declaration emit contains no `effect`. If tuple inference fails with deps last, switch to an overload or a builder form before .2.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
|-----|-------------|---------|-------------------|
| R1 | tag() and abstract-class Tags | .1 | — |
| R2 | layer() impl forms and cleanup | .1 | — |
| R3 | module() and plain errors | .1 | — |
| R4 | action and query | .2 | — |
| R5 | configureRuntime | .2 | — |
| R6 | React hooks | .3 | — |
| R7 | no Effect in .d.ts | .1, .2, .3 | — |
| R8 | snapshot passthrough | .1 | — |
| R9 | showcase-kit port | .4 | — |
| R10 | docs and CI | .4 | — |
