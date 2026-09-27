---
satisfies: [R8]
---
# fn-1-sleekstack-effect-native-di-modules-and.5 Next adapter: configureRuntime, action/query request scopes, per-op provide, streaming probe

## Description
Next.js adapter on the core scope runtime (R8).

**Size:** M
**Files:** `packages/next/src/index.ts`, `packages/next/src/runtime.ts`, `packages/next/src/action.ts`, `packages/next/src/__tests__/next.test.ts`, `packages/next/package.json`
**Touches:** [packages/next/**]

## Approach
- `configureRuntime({ provide, onFinalizerError })` stores config; app runtime created lazily on first use in a process-global slot (`globalValue` from `effect/GlobalValue`) so dev HMR does not duplicate it. Same config reference again -> no-op; different config -> dispose existing app scope, replace, dev warning.
- `action(fn)` / `query(fn)` per spec API Contracts: return a callable `(...args) => Promise<R>`; each call opens a request scope, runs `fn(...args)`, checks for stream shapes, closes the scope (on success, failure, or defect), then settles; failures reject with an `Error` carrying the Effect Cause. Never via `after()`.
- `{ provide }` entries are built in the request scope via core's child-boundary API, shadowing the global graph for that operation only.
- Request-scope finalizer failures after a successful op go to `onFinalizerError`; the op result is unchanged.
- Unconfigured -> descriptive error at call time.
- Stream-shaped results (ReadableStream / async iterable) -> descriptive error (stream-aware close deferred per spec Boundaries).

## Investigation targets
**Required:**
- https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
- https://github.com/mcrovero/effect-nextjs — prior art (globalValue, per-invocation context)
**Optional:**
- https://nextjs.org/docs/app/api-reference/functions/after

## Acceptance
- [ ] Request-scoped finalizer runs after action completes, after typed failure, and after defect
- [ ] Arguments forward to `fn`; typed failure rejects with Error whose cause holds the Effect Cause
- [ ] Calling the same action twice opens two distinct request scopes
- [ ] 20 concurrent actions never share a request-scoped instance
- [ ] Per-op provide affects only that op
- [ ] Unconfigured call throws descriptive error
- [ ] Returning a ReadableStream or async iterable raises the descriptive error
- [ ] Re-configure with same config is a no-op; with a different config the old app scope's finalizers run and new services are used
- [ ] Per-op provide of an app-lifetime service overrides the global instance for that op only

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
