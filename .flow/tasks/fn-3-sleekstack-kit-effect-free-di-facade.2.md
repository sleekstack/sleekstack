---
satisfies: [R4, R5, R7]
---
# fn-3-sleekstack-kit-effect-free-di-facade.2 @sleekstack/kit/next: action, query, fail, configureRuntime

## Description
The Next adapter: dependency-array actions and queries lowered onto `@sleekstack/next`, plus the ActionResult/fail convention and a configureRuntime passthrough.

**Size:** M
**Files:** packages/kit/src/next/{index.ts,action.ts,runtime.ts}, packages/kit/src/__tests__/next.test.ts, packages/kit/src/__tests__/next-types.test-d.ts
**Touches:** [packages/kit/src/next/**, packages/kit/src/__tests__/next*.ts]

### Approach
- `action(factory, deps, opts)` returns `async (...args) => ActionResult<R>` by delegating to next `action(opts, fn)` (packages/next/src/action.ts:87-96). The delegated Effect: check each dep Tag with a serviceOption-style lookup (a missing one returns an error sentinel with code MissingDependency), resolve, call `factory(...deps)`, await the handler through the .1 adapter, and **return the raw value** so next's stream guard sees it. A `fail` becomes a unique-symbol failure sentinel; any other failure is caught into an error sentinel `{code, message, details}` via .1 `normalize`. Outside next: failure sentinel -> `{ok:false,error}`, error sentinel -> throw SleekStackError, anything else -> `{ok:true,data}`.
- `opts.provide` and `configureRuntime.provide` take kit `Layer | Module`: call .1 `validateProvide`, unwrap to core entries, pass to next. The `configureRuntime` wrapper converts the Cause to `FinalizerError` for `onFinalizerError`, and caches the unwrapped config per kit config reference so the same-reference no-op still holds.
- `query` is the same, but returns the plain value; a `fail` rejects with its message.
- Tests follow packages/next/src/__tests__/next.test.ts: keep the unconfigured case first (a process-global slot), run 20 concurrent calls with distinct request ids, a request-lifetime Layer with cleanup order, fail vs throw, Shadowing through provide, and stream rejection.
- next-types.test-d: `typeof getUser` is `(id: string) => Promise<ActionResult<User|undefined>>`.

### Investigation targets
**Required:**
- packages/next/src/action.ts, runtime.ts
- packages/next/src/__tests__/next.test.ts:6-7, 74-86
**Optional:**
- fn-2 branch apps/showcase/src/server/board.actions.ts (ActionResult pattern)

### Key context
- In a `'use server'` file every export must be an async function; `action()` must return one directly.
- Never reimplement request scopes; next's `run()` owns them.
## Acceptance
- [ ] action/query resolve deps per request; handler args typed without deps (test-d)
- [ ] fail -> {ok:false}; throw rejects; stream rejects; missing dep rejects MissingDependency
- [ ] 20 concurrent actions get distinct request-lifetime instances; request cleanups run after each call
- [ ] provide shadows per call
- [ ] unconfigured runtime rejects; repeat configureRuntime is a no-op
- [ ] dts.test still green (next subpath included); typecheck and test green
- [ ] ReadableStream and async-iterable returns reject through kit action and query
- [ ] a request-Layer failure reaches the caller as SleekStackError with .code/.details intact
- [ ] duplicate Tag in opts.provide or configureRuntime -> DuplicateTag
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
