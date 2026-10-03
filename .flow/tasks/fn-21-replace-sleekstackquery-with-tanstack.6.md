---
satisfies: [R7, R8]
---
# fn-21-replace-sleekstackquery-with-tanstack.6 ui: useQuery with ref-counted observer registry

## Description
The ui query binding, read side (R7, R8): `useQueryClient`, `useQuery`, and the per-store registry that keeps observer identity stable across re-runs.

**Size:** M
**Files:** `packages/ui/src/query.ts` (new), `packages/ui/package.json` (`./query` export, peer + dev dependency `@tanstack/query-core`), `packages/ui/src/__tests__/query.test.ts` (new, jsdom)
**Touches:** [packages/ui/src/query.ts, packages/ui/package.json, packages/ui/src/__tests__/query.test.ts, pnpm-lock.yaml]

### Approach
- Per-store registry (`WeakMap<AtomStore, Map<queryHash, Entry>>`), `Entry = { observer, atom, refs }`. A run acquires an entry in its per-run scope (fn-19's `RenderScope`, `packages/ui/src/reactive.ts`) and releases it on scope close; the last release unsubscribes the observer and drops the entry. Rely on fn-19's rule that the previous run's scope is released only after the new run succeeded, so the count stays above zero across re-runs; do not add your own delay.
- The observer subscription writes each result to the entry's writable atom with `Store.set`; the hook reads it with `useAtomValue` (`packages/ui/src/reactive.ts`) so re-rendering is the existing fn-19 path. Every run calls `observer.setOptions` with the latest options.
- `useQuery`'s result type is TanStack's `QueryObserverResult`; requirements `QueryClientTag | Store`. Reject `throwOnError` at the type level.
- Test with a fake `queryFn` counting calls and `retry: false`: unrelated atom change causes no new fetch under `staleTime: 0`; two components, one key, one fetch; entry dropped when the last scope closes; a rejected `queryFn` renders `status: 'error'`.

### Investigation targets
**Required**:
- `packages/ui/src/reactive.ts` (hooks, scope service), `packages/ui/src/dom.ts` (how run scopes close), `packages/ui/src/__tests__/reactive-dom.test.ts` (jsdom pattern)
- `packages/query/src/client.ts` (task 1); `.flow/specs/fn-21-replace-sleekstackquery-with-tanstack.md` ("UI bindings")

### Key context
The fn-19 code is the reference for scope and store access; read the `RenderScope` handling there before writing the registry.

## Acceptance
- [ ] `useQuery` renders the current result and a resolved fetch re-renders only the components that read that query (R7)
- [ ] A rejected `queryFn` renders `status: 'error'`, never an Effect failure (R7)
- [ ] An unrelated atom change causes no new fetch with `staleTime: 0`; two components with one key share one entry and one fetch; the entry is dropped when the last using scope closes (R8)
- [ ] `pnpm --filter @sleekstack/ui test` and `typecheck` pass

## Done summary
Added `@sleekstack/ui/query` with `useQueryClient` and `useQuery`. Each query's observer lives in a registry keyed by store and query hash, and run scopes ref-count it. Results go to a writable atom, and the component reads that atom through `useAtomValue`. jsdom tests cover R7 and R8: pending then success, error as a result, no refetch when an unrelated atom changes, one fetch shared by two readers, and the observer dropped when the last scope closes.

stage: impl-review - ran (codex fan-out NEEDS_WORK on one P3 test gap, fixed, re-review SHIP)
Tier: opus at medium
## Evidence
- Commits: 66985c6935f132e6944fc926eb627c76759f56d5, ff41f2b594f11a1b83f5dfb4363190113ed5c054
- Tests: pnpm --filter @sleekstack/ui test, pnpm --filter @sleekstack/ui typecheck
- PRs: