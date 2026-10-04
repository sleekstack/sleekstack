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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
