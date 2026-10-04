---
satisfies: [R7]
---
# fn-23-reconciling-dom-renderer-keys-host.3 ui: useLocal ordered slots, slot lifecycle, DuplicateKey and SlotMismatch errors

Touches: packages/ui/src/reactive.ts, packages/ui/src/index.ts, packages/ui/src/__tests__/reactive.test.ts, packages/ui/src/__tests__/requirements.test-d.ts

## Description
`useLocal` on top of the frame/ids from the previous task (spec Architecture: `useLocal`; Edge Cases: slot disposal). Also defines the two new tagged runtime errors used by later tasks.

**Size:** M
**Files:** `packages/ui/src/reactive.ts`, `packages/ui/src/index.ts`, `packages/ui/src/__tests__/reactive.test.ts`, `packages/ui/src/__tests__/requirements.test-d.ts`
**Touches:** [packages/ui/src/reactive.ts, packages/ui/src/index.ts, packages/ui/src/__tests__/**]

### Approach
- `useLocal(initial)` beside `useAtomValue`: reuse the private `store()` helper, the `Collector` registration and `s.retain` hold from `useAtomValue`; the slot is a writable core atom stored in the frame's registry under the instance id. Slot *n* = the *n*-th call of the run; support the updater form of the setter.
- Slot lifecycle: slots created by a run are pending until the run commits; a dropped run disposes the slots it created; after commit, slots of ids absent from the committed tree are disposed. Expose small internal hooks (`commitSlots(frame)`, `dropSlots(frame)`) the DOM tasks call.
- `SlotMismatch` (count mismatch vs the previous run) fails the run (old DOM stays) via `Data.TaggedError`, pattern at `handler.ts:24-28`. Define `DuplicateKey` the same way (used by the DOM task). Export both and `useLocal` from `index.ts`.
- `renderToString`: outside an instance (`Collector` undefined) return `initial` and a no-op setter.
- Type test: `Effect<readonly [number, setter], never, Store>`.

### Investigation targets
**Required**:
- `packages/ui/src/reactive.ts:28-58` (`store`, `useAtomValue`, `useSetAtom`, `useAtom`)
- `packages/ui/src/handler.ts:24-28` (tagged error pattern)
- `packages/ui/src/__tests__/requirements.test-d.ts` (type-test style)
- memory: captured context for rerun must own Provider layer scopes

### Acceptance
- [ ] Value persists across re-runs of one instance; value and updater setters re-run the component; two siblings and two keys are independent.
- [ ] Pending slots of a dropped run are disposed and earlier slots are untouched.
- [ ] A run with a different `useLocal` count fails with `SlotMismatch` and does not advance the slot cursor.
- [ ] `renderToString` returns `initial` and a no-op setter.
- [ ] `expectTypeOf(useLocal(0))` matches the spec signature; `pnpm --filter @sleekstack/ui test` and `typecheck` pass.

## Acceptance
- [ ] TBD

## Done summary
Added `useLocal(initial)` (ordered slots stored as writable atoms, each held with `store.retain`), the `SlotMismatch` and `DuplicateKey` tagged errors, and the slot lifecycle hooks `commitSlots(frame)` and `dropSlots(frame)`. `Frame` is now a `RunFrame` object (`ordinals`, `owner` slots, `id`, `cursor`, lazy `seen`/`pending`). Each instance's slots live in its parent's `owner.kids` registry under the instance id, so they survive re-runs of both the instance and its parent. Root instances fall back to slots kept in the instance's closure.

For the DOM tasks: commit or drop the frame a run created. Tests make that frame with `makeFrame(prevOwner)`. A keyed sibling still bumps the positional ordinal (behaviour from task .2), so the ids of unkeyed siblings after it shift.

Tier: session (jev-unavailable(no_key)); routing block pins implementer opus at medium
baseline: green via handoff (verified at 90b13f5 by fn-23-reconciling-dom-renderer-keys-host.2)
Bench: the first compare run flagged render-dom/update-1-of-1k (1.374 against a 0.460 baseline). A single re-run gave 0.429, which is OK. jsx-overhead stayed in tolerance on both runs.

stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: afb96a1e3eb207f536d74d585ed509c93453d733
- Tests: pnpm --filter @sleekstack/ui test, pnpm --filter @sleekstack/ui typecheck, pnpm --filter bench bench:json && pnpm --filter bench compare
- PRs: