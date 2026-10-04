---
satisfies: [R3]
---
# fn-21-replace-sleekstackquery-with-tanstack.2 react: QueryProvider over the official react-query hooks

## Description
Replace `@sleekstack/react`'s own query hooks with the official `@tanstack/react-query` (R3).

**Size:** M
**Files:** `packages/react/src/query.ts` (rewritten to `QueryProvider`), `packages/react/src/HydrateQueries.tsx` (deleted), `packages/react/src/index.tsx`, `packages/react/package.json`, `packages/react/src/__tests__/query.test.tsx` (ported)
**Touches:** [packages/react/src/query.ts, packages/react/src/HydrateQueries.tsx, packages/react/src/index.tsx, packages/react/package.json, packages/react/src/__tests__/query.test.tsx, pnpm-lock.yaml]

### Approach
- `QueryProvider` reads `QueryClientTag` from the app scope the root `LayerProvider` holds (see how `LayerProvider` and `managedScope.ts` expose scope services, `packages/react/src/LayerProvider.tsx:74`, `packages/react/src/managedScope.ts:143`) and renders `QueryClientProvider` with that client. One client per root; it is closed with the root scope (the Layer's finalizer, not the component).
- Remove the old `useQuery` / `useMutation` / `HydrateQueries` exports (no shims); `@tanstack/react-query` is a peer dependency, consumers import hooks from it. Re-export nothing from it.
- Port `query.test.tsx` to the new shape: provider supplies the scope's client, two roots get two clients, the client is cleared on root unmount.

### Investigation targets
**Required**:
- `packages/react/src/query.ts` (311 lines), `packages/react/src/HydrateQueries.tsx`, `packages/react/src/LayerProvider.tsx`, `packages/react/src/index.tsx`
- `packages/react/src/__tests__/query.test.tsx`
- `packages/query/src/client.ts` (task 1)

### Key context
Hydration now uses TanStack's own `dehydrate` / `HydrationBoundary`; this task adds no SSR code.

## Acceptance
- [ ] `QueryProvider` supplies the scope's client to `@tanstack/react-query` hooks; two `LayerProvider` roots get two clients; unmounting the root clears its client (R3)
- [ ] `@sleekstack/react` no longer exports `useQuery`, `useMutation` or `HydrateQueries`
- [ ] `pnpm --filter @sleekstack/react test` and `typecheck` pass

## Done summary
Replaced @sleekstack/react's own query hooks with QueryProvider, which feeds @tanstack/react-query's QueryClientProvider from QueryClientTag in the LayerProvider scope; useQuery/useMutation/HydrateQueries (and hydrate.test.tsx) removed, @tanstack/react-query added as peer + dev dep. query.test.tsx covers per-root clients, clear on root unmount, and removed exports.

Follow-ups: context.ts QueryStoreContext is now dead (outside Touches); kit/showcase/docs/devtools still import the removed hooks (tasks .4/.5/.9/.10).

Tier: IMPLEMENTER opus at medium
stage: impl-review - ran (codex fan-out, 3 draws SHIP)
## Evidence
- Commits: 9f8bf9564a1843f46686a2acfa0a69e91e37876b, c5392c47863462f9bfcb65cd268a0cb9a780fde6
- Tests: pnpm --filter @sleekstack/react test, pnpm --filter @sleekstack/react typecheck
- PRs: