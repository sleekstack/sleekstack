---
satisfies: [R9]
---
# fn-21-replace-sleekstackquery-with-tanstack.7 ui: useMutation, server render and dispose behavior

## Description
The ui query binding, write side plus lifecycle (R9): `useMutation`, no-fetch string render, and clean disposal.

**Size:** M
**Files:** `packages/ui/src/query.ts`, `packages/ui/src/string.ts` (only if the no-subscribe path needs a hook point), `packages/ui/src/__tests__/query-mutation.test.ts` (new, jsdom)
**Touches:** [packages/ui/src/query.ts, packages/ui/src/string.ts, packages/ui/src/__tests__/query-mutation.test.ts]

### Approach
- `useMutation` creates a `MutationObserver` in the run scope (no sharing, no registry); result goes to an atom as in task 6; expose `mutate` / `mutateAsync` as plain functions so a `fromReact` guest can receive `mutate` as a prop.
- Server render: when running under `renderToString`, `useQuery` builds its result from `client.getQueryState` / current data without subscribing or fetching, and `useMutation` returns idle. Detect the string render through whatever fn-19 exposes (look at how `renderToString` provides `Store` and a scope in `packages/ui/src/string.ts`); do not add a second mechanism.
- Dispose / superseding mount: every observer unsubscribed, no timers left (assert with fake timers); the client is untouched (the Layer owns it).

### Investigation targets
**Required**:
- `packages/ui/src/query.ts` (task 6), `packages/ui/src/string.ts`, `packages/ui/src/reactive.ts`
- `packages/ui/src/__tests__/reactive.test.ts` — how string-render tests provide a store

### Key context
Guest React state is lost when the reading component's subtree is swapped; keep the guest that calls `mutate` outside the reader in tests.

## Acceptance
- [ ] `mutate` called from a guest prop updates the reading component; a failing `mutationFn` yields `status: 'error'` and `mutateAsync` rejects with the original error (R9)
- [ ] `renderToString` starts no fetch: a prefetched query renders its data, an unprefetched one renders `pending` (R9)
- [ ] `dispose` and a superseding `mount` leave no observers or timers from this module (R9)
- [ ] `pnpm --filter @sleekstack/ui test` and `typecheck` pass

## Done summary
useMutation per component instance (Instance reference in reactive.ts), idle/no-subscribe on server render, dispose unsubscribes; tests in query-mutation.test.ts.
## Evidence
- Commits: d10dc51
- Tests: pnpm --filter @sleekstack/ui test, pnpm --filter @sleekstack/ui typecheck
- PRs: