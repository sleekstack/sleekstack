---
satisfies: [R3, R4]
---
# fn-17-atom-ssr-and-hydration.3 React: hydrate prop, transport and AtomsSnapshot

Touches: packages/react/src/transport.ts, packages/react/src/AtomsSnapshot.tsx, packages/react/src/LayerProvider.tsx, packages/react/src/managedScope.ts, packages/react/src/index.tsx, packages/react/src/__tests__/**

## Description
Size: M. Client seeding, keyed transport and the snapshot component (R3, R4).

**Touches:** packages/react/src/transport.ts, packages/react/src/AtomsSnapshot.tsx, packages/react/src/LayerProvider.tsx, packages/react/src/managedScope.ts, packages/react/src/index.tsx, packages/react/src/__tests__/**

**Files:**
- `packages/react/src/transport.ts` - new, single owner of the transport decision: `readSnapshot(id)` (find tag by id; for an absent id, use the unkeyed tag only if exactly one exists; guarded `JSON.parse`; non-object or malformed becomes `{}` with a dev warning; remembers the raw text for preservation) and `encodeSnapshot(snapshot)` (escaped JSON)
- `packages/react/src/LayerProvider.tsx` - `hydrate?: Snapshot`, `snapshotId?: string` props; expose `snapshotId` to `AtomsSnapshot` via provider state
- `packages/react/src/managedScope.ts` - only pass the snapshot into `atomStoreFor` options at :136 (`hydrate` passes through: `atomStoreFor` omits only `context`/`wrapBuild`). No server branching here.
- `packages/react/src/AtomsSnapshot.tsx` - new; server: `dehydrate(store)` + `encodeSnapshot`; client: preserved raw text from `transport.ts`, `suppressHydrationWarning`
- `packages/react/src/index.tsx` - export `AtomsSnapshot`
- `packages/react/src/__tests__/hydrate.atoms.test.tsx` - SSR via `renderWithAtoms`, then `hydrateRoot` in jsdom

## Approach
- Prop `hydrate` wins over transport; otherwise `readSnapshot(snapshotId)`. Both go through core `hydrate(store, snapshot)`.
- Escape `<`, `>`, `&`, U+2028, U+2029 to `\u` escapes.
- fn-12's `HydrateQueries.tsx` (worktree) uses the same script-preservation structure with an unguarded `JSON.parse`; follow its structure but guard the parse. Do not change `HydrateQueries` in this task.
- Mismatch test: spy `console.error` during `hydrateRoot`, assert no hydration warnings; count Effect runs.

## Investigation targets
**Required:**
- `packages/react/src/managedScope.ts` - store creation at :136
- `packages/core/src/atom/scope.ts` - option pass-through
- `.claude/worktrees/fn-12/packages/react/src/HydrateQueries.tsx` - transport structure to mirror
**Optional:**
- `.claude/worktrees/fn-12/packages/react/src/__tests__/hydrate.test.tsx` - SSR/hydrate test harness

## Acceptance
- [ ] `<LayerProvider hydrate>` and transport seed serializable atoms; first client render equals server HTML with no hydration warning (jsdom)
- [ ] Seeded result atom runs zero times on hydrate, once after `refresh`; no Suspense fallback for it; non-serializable derived atom recomputes from seeded sources; decode failure falls back to a normal load
- [ ] Malformed transport JSON and non-object payload yield an empty snapshot, a dev warning and a normal load (test)
- [ ] Two roots with different `snapshotId`s and values hydrate their own values; a provider without `snapshotId` ignores transport when two unkeyed tags exist (test)
- [ ] `AtomsSnapshot` output carries the `snapshotId`; values with `</script>`, an HTML comment opener, U+2028/U+2029 cannot break out and round-trip; outside a provider throws the existing error
- [ ] Transport lookup exists only in `transport.ts`

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
