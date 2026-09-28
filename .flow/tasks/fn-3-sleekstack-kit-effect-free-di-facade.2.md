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
- `action(factory, deps, opts)` returns `async (...args) => ActionResult<R>` by delegating to next `action(opts, fn)` (packages/next/src/action.ts:87-96). The Effect fn resolves each dep Tag from context, calls `factory(...deps)`, then awaits the handler through the promise adapter from .1. A `fail` brand maps to `{ok:false,error}`, success to `{ok:true,data}`, anything else rejects.
- `query` is the same, but returns the plain value; a `fail` rejects with its message.
- `opts.provide` accepts kit Layers and modules (they're already core entries) and is passed straight to next.
- `configureRuntime` re-exports or thin-wraps next's (runtime.ts:48-63).
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

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
