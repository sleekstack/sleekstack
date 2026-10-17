---
satisfies: [R3]
---
# fn-56-model-and-draft-move-to-sleekstackmodel.1 ui/internal: slot-hook extension point and own-write hook

## Description
Give packages outside `ui` what `useDraft` needs from the renderer, as documented-unstable exports of `@sleekstack/ui/internal`: a way to take a slot in the running component's frame (with first-run and mismatch handling) and the render-time own-write marker that stops the renderer re-running an instance for a write its own run made. `ui`'s own hooks and renderer use the same exports, so there is one mechanism, not a copy.

**Size:** M
**Files:** packages/ui/src/reactive.ts, packages/ui/src/internal.ts, packages/ui/src/dom.ts, a new test under packages/ui/src/__tests__/, packages/ui/README.md (internal entry note)
**Touches:** [packages/ui/src/**, packages/ui/README.md]

### Approach
- Export from `internal.ts` a small `slot hook` surface built from today's private slot helpers (the slot taker, the frame accessor, the `Store` tag, the missing-store failure) and move `ownWrite` behind it; keep names unexported from the public index.
- Rewire `dom.ts` and the existing hooks to consume the same surface; do not change any hook's behavior.
- Equivalence pin: every existing ui test, including the draft tests that still live in ui in this task, passes unchanged; the exports list of `index.ts` is unchanged.
- Add one test using the extension point from outside the hooks (a tiny test-only slot hook) covering first run, later runs, a slot-count mismatch, and a call outside a component.

### Investigation targets
**Required**:
- `packages/ui/src/reactive.ts` (`takeSlot`, `RunFrame`, `Slots`, `Store`, `missingStore`, `ownWrite`, `useDraft`)
- `packages/ui/src/dom.ts` (uses of `ownWrite`)
- `packages/ui/src/internal.ts`
- `packages/query/src/ui.ts` (a consumer of `ui/internal`)
**Optional**:
- `docs/adr/0025-*.md`, `docs/adr/0038-model-and-draft.md`

## Acceptance
- [ ] `@sleekstack/ui/internal` exports the slot-hook surface and the own-write marker; the public index exports nothing new
- [ ] A test-only external slot hook behaves like `ui`'s own: stable across runs, `SlotMismatch` on a changed slot count, a call outside a component handled as `useDraft` handles it today
- [ ] All existing ui and query tests pass unchanged; ui exports snapshot unchanged
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui...` is green

## Done summary
`@sleekstack/ui/internal` now exports the slot-hook surface (`Store`, `Frame`, `takeSlot`, `missingStore`, `writeOwn`, types `RunFrame`/`Slots`); the mutable `ownWrite` object became `writeOwn` (re-entrant, restores the outer writer) plus `isOwnWrite`, used by `useDraft` and `dom.ts`. The public index is unchanged. A test-only external slot hook in `packages/ui/src/__tests__/slot-hook.test.ts` covers stable slots across runs, `SlotMismatch`, a call outside a component (slot-free value with a Store, `MissingDependency` without one), and nested `writeOwn`. Early proof point holds: no hook behavior changed and all existing ui/query/analyze tests pass.

baseline: green (pnpm turbo run test typecheck --filter=@sleekstack/ui...)
Extra checks: pnpm turbo run test typecheck --filter=@sleekstack/query --filter=@sleekstack/analyze green. packages/ui/README.md prettier warning predates this task.

Tier: implementer opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK: Store missing from ui/internal, writeOwn not re-entrant; fixed in da9084e; re-review SHIP)
## Evidence
- Commits: f81066b84b80c2cc40d34af84061923811864cb8, da9084ef40290ba3455bcfe69a05a8225135e5c5
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui..., pnpm turbo run test typecheck --filter=@sleekstack/query --filter=@sleekstack/analyze
- PRs: