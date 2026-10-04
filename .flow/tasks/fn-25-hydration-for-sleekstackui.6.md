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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
