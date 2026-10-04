---
satisfies: [R6]
---
# fn-23-reconciling-dom-renderer-keys-host.7 ui dom: host event listeners with captured context and interruption

Touches: packages/ui/src/dom.ts, packages/ui/src/__tests__/reactive-dom.test.ts

## Description
Host `onXxx` closures run in the renderer (spec Architecture: Events; Edge Cases: event closure lifetime).

**Size:** M
**Files:** `packages/ui/src/dom.ts`, `packages/ui/src/__tests__/reactive-dom.test.ts`
**Touches:** [packages/ui/src/dom.ts, packages/ui/src/__tests__/reactive-dom.test.ts]

### Approach
- On create: one direct `addEventListener` per element and event name, a stable proxy that reads the current `EventBinding` from the element's `Live`. Patch swaps the stored binding (no re-listen); a removed event or element removes the listener.
- Dispatch: `Effect.runFork(binding.run(event))` provided with `binding.context`; a sync `Effect.sync` that calls `event.preventDefault()` therefore runs before the listener returns. Track the fiber on the element's `Live`; interrupt on element removal, instance kill and `Mounted.dispose()`. Sync throw, non-Effect return, failure or defect go to `onError` (reuse `reportRenderError` / `safeReport`).
- Do not apply `checkEvent` (non-bubbling events are allowed here).

### Investigation targets
**Required**:
- `packages/ui/src/component.ts:33-63` (`runToNode`, `reportRenderError`), `packages/ui/src/dom.ts:242-250` (`safeReport`)
- `packages/ui/src/__tests__/reactive-dom.test.ts:10-29` (helpers), `packages/ui/src/__tests__/handler.test.ts:79-83`
- memory: atom writes do not interrupt an in-flight Effect build

### Acceptance
- [ ] A click runs the closure with a `Provider` layer above the element visible, including a `Provider` between the component and the element and an element inside a component that reads no atoms.
- [ ] One listener per element and event after N patches; the closure is swapped without re-listening; removing the prop removes the listener.
- [ ] A failure, defect, sync throw and non-Effect return each reach `onError`; a closure running after `dispose()` resolved fails the test; a non-bubbling event (e.g. `focusin`/`mouseenter`) works.

## Acceptance
- [ ] TBD

## Done summary
Host `onXxx` closures now run in the DOM renderer: one direct listener per element and event reading the current binding from shared `Events` state on the element's Live; patches swap bindings without re-listening and remove listeners for dropped props; fibers run with the captured context, are interrupted on element removal/instance kill/dispose, and every failure kind goes to `onError`. Tests: 5 new in reactive-dom.test.ts "host events" (red before, green after).

Bench: all OK; render-string/list-1k ratio 2.492 (baseline 1.742).
Tier: session (jev-unavailable(no_key)); routing block pins implementer opus at medium

stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: 78ac97fbe29b9acfffcdcb14d87aa9f99ca91f5a
- Tests: pnpm --filter @sleekstack/ui test, pnpm --filter @sleekstack/ui typecheck, pnpm --filter bench bench:json && pnpm --filter bench compare, baseline: green via handoff (b05de42)
- PRs: