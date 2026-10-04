---
satisfies: [R5]
---
# fn-25-hydration-for-sleekstackui.6 ui: hydration state payload (atoms via core dehydrate, queries via TanStack DehydratedState)

## Description
No new format: embed a payload in the server HTML under a distinct attribute and seed the store before the first component run.

**Size:** M
**Files:** packages/ui/src/string.ts, packages/ui/src/dom.ts (or hydrate.ts), packages/ui/src/query.ts, packages/ui/src/__tests__/hydrate.test.ts
**Touches:** [packages/ui/src/string.ts, packages/ui/src/dom.ts, packages/ui/src/hydrate.ts, packages/ui/src/query.ts, packages/ui/src/__tests__/hydrate*]

### Approach
- Payload script uses `data-sleek-hydrate`, never `data-sleek-manifest` (resume's readManifest requires exactly one manifest script; hydration ignores the manifest).
- Run core `dehydrate(store)` before `store.dispose()` in `renderToString`; `hydrateMount` seeds the store (also when `opts.store` is given) with core `hydrate` before components run, so each runs once. Query state is TanStack `DehydratedState` (see packages/next/src/query.ts); first confirm where `HydrateQueries` lives.
- Missing or malformed payload falls back to client initial values and reports a tagged error. Escape with `scriptJson`.

### Investigation targets
**Required** (read before coding):
- packages/core/src/atom/AtomStore.ts dehydrate/hydrate (~l.417-423), Atom.ts serializable (~l.196)
- packages/next/src/query.ts (~l.10, 35)
- packages/react/src/AtomsSnapshot.tsx transport precedent
- `packages/ui/src/string.ts` manifest/scriptJson (~l.37-54)

## Acceptance
- [ ] Atom and query state set on the server is the client's initial value with no refetch (R5).
- [ ] Malformed/missing payload covered; resume.test.ts still green.

## Done summary
renderToString now appends a `data-sleek-hydrate` script (never the resume manifest). It holds core `dehydrate(store)`, taken before dispose, plus the layer QueryClient's TanStack `DehydratedState`, and is left out when both are empty. The server store keeps idle nodes until dispose so dehydrate sees every atom the render built. hydrateMount reads and removes the script, then seeds the store (also a given `opts.store`) and the QueryClient before the first run, so each component runs once. A malformed payload reports a new tagged error, `HydratePayloadInvalid` (exported), and falls back to client initial values. A missing payload falls back silently, because the server leaves the script out when there is no state.

Outside Touches: on the server, useQuery/useSuspenseQuery/useMutation now read through a throwaway atom so server markup carries the same `sleek-reactive` host as the client. Without this every query component reported HydrationMismatch. The exact-string assertions in handler/query/query-mutation tests were updated for the new output, and index.ts exports the error. No-refetch holds when staleTime > 0; with staleTime 0 TanStack refetches on mount, same as React Query.

Tests: packages/ui/src/__tests__/hydrate.test.ts "hydrateMount state payload (R5)" covers atom seeding (given store, one run), query no refetch, and the missing / malformed / wrong-shape cases. resume.test.ts green.

baseline: green via handoff (verified at fcc2624 by fn-25.5: ui gate)
Tier: implementer: opus at medium (project routing block)
stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: afa1a7ab16161cf96403e7a3a3d95eebf5841192
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=ui-demo
- PRs: