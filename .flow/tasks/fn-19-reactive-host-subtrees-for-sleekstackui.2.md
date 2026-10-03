---
satisfies: [R1, R2, R3, R4, R5, R6, R9]
---
# fn-19-reactive-host-subtrees-for-sleekstackui.2 ui: DOM renderer subscribes, re-runs and swaps reactive components

## Description
The client half: `mount` owns a store, subscribes every `Reactive` node after the first commit, re-runs the component with its captured context on change and swaps only that subtree (R2-R6, R9).

**Size:** M
**Files:** `packages/ui/src/dom.ts`, `packages/ui/src/__tests__/reactive-dom.test.ts` (new, jsdom)
**Touches:** [packages/ui/src/dom.ts, packages/ui/src/__tests__/reactive-dom.test.ts]

### Approach
- `mount` creates one `AtomStore` (or uses `opts.store`) and provides it as `Store`; dispose it on `dispose` / supersede only when `mount` created it (R6).
- Extend `build` (`packages/ui/src/dom.ts:50-90`) with a `Reactive` case: a `<sleek-reactive>` host with `display: contents` (the `Guest` case at `dom.ts:73-82` is the pattern). After the first commit, subscribe to each atom with `store.subscribe` and call `rerun`.
- A rerun result is a node; if it is a `Reactive` again, replace the subscription set with its `atoms`.
- Latest wins: one fiber per instance; a new change interrupts the in-flight one (Effect fiber interrupt, as `runToNode` runs Effects at `component.ts:34-47`). Batched changes notify once.
- Swap in one `replaceChildren`; unmount guest roots created in the old subtree first, then record the new roots. An outer swap tears down inner subscriptions with the old subtree.
- Failure (R5): a tagged error with a matching handler on the captured handler stack renders that fallback in place of the component's subtree; anything else keeps the old DOM, goes to `reportRenderError` / `onError` (`component.ts:56-62`), and stays subscribed.
- The generation token (`dom.ts:34-48`) covers late completions: a superseded or disposed mount writes nothing, unsubscribes everything and interrupts in-flight reruns (R9).

### Investigation targets
**Required** (read before coding):
- `packages/ui/src/dom.ts` — whole file, generation token and roots bookkeeping
- `packages/ui/src/component.ts:34-62` — error and rejection contract
- `packages/ui/src/reactive.ts` (from task 1) — hooks, handler stack
- `packages/core/src/atom/AtomStore.ts:28-72, 291-316` — `subscribe`, batching, `dispose`
**Optional**:
- `packages/ui/src/__tests__/dom.test.ts` — jsdom pattern

### Key context
For R6, test with a `fromReact` guest that receives the `useSetAtom` setter as a prop and click it. Guest React state inside a swapped subtree is lost by design (spec Boundaries).

## Acceptance
- [ ] A change re-runs only the components that read that atom; siblings and ancestors keep the same DOM nodes (identity check)
- [ ] The re-run sees enclosing `Provider` layers (R3)
- [ ] Rapid changes keep the latest value; a slower earlier re-run never overwrites a later one and is interrupted (R4)
- [ ] A re-run failing with a tag handled by an enclosing `Boundary` renders its fallback in place of the component; an unhandled error keeps the old DOM, calls `onError` once and the next change retries; a throwing `onError` is logged and does not replace the outcome (R5)
- [ ] `Store` is the mount's store; a guest given the setter updates the reader on click; a store passed in `opts.store` is not disposed (R6)
- [ ] `dispose` and a superseding `mount` unsubscribe, interrupt and unmount guests; late completions write nothing (R9)
- [ ] Nested reactive components: inner change touches only the inner host; outer change recreates inner subscriptions

## Done summary
`mount` now provides `Store` (created or `opts.store`, disposed only when created) and a mount `RenderScope` (the mount layer is built into it), renders `Reactive` nodes into `<sleek-reactive style="display: contents">` hosts, subscribes their atoms, re-runs on change (coalesced per tick, latest wins via fiber interrupt) and swaps only that host transactionally; boundary fallbacks apply on re-run, unhandled failures keep the DOM and report through `onError`; dispose/supersede unsubscribes, interrupts and unmounts guests. Tests: packages/ui/src/__tests__/reactive-dom.test.ts (13 cases covering all ACs).

Outside declared Touches (required by review findings): packages/ui/src/reactive.ts (re-run applies captured Boundary handlers; renderer owns run scopes via `ReactiveNode.scope` / `runScopes`; reads retain atoms and record `seen` values; `fallbacks` marker), packages/ui/src/node.ts (internal `seen` / `scope` fields on ReactiveNode), packages/ui/src/__tests__/reactive.test.ts (task-1 test now asserts the renderer, not rerun, closes a superseded run scope).

stage: impl-review - ran (codex: NEEDS_WORK x4 fan-out rounds on moving HEAD, -> SHIP)
Tier: opus at medium
## Evidence
- Commits: 38bfa937adf8d3f9763dc62954e61a8218efb03b, cb01197df86221212caf422a4c65b9cde23a4269, d93e92413b5c6bf51c4a4347ef4a23b5a9f9037f, 099ad2034b2a0c254b99748d7188a685e9dabde0, e58c76b86205e466b30f31fcb025b56419fd159d, 0960f933f70582c2e9d5cf309c4f80222df20158, a9a5766e4c82898453b083802a5ae64d103687ba
- Tests: pnpm --filter @sleekstack/ui test, pnpm --filter @sleekstack/ui typecheck, pnpm --filter @sleekstack/analyze test, apps/ui-demo: npx vitest run && npx tsc --noEmit
- PRs: