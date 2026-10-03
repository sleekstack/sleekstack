---
satisfies: [R1, R6]
---
# fn-19-reactive-host-subtrees-for-sleekstackui.1 ui: hooks, Store, instance wrapper and Reactive node with string render

## Description
The static half of automatic reactivity: the hooks, the `Store` Tag, the per-instance wrapper in the JSX runtime, the `Reactive` node and the string renderer. Split from the DOM work so the node shape and context capture settle first.

**Size:** M
**Files:** `packages/ui/src/node.ts`, `packages/ui/src/reactive.ts` (new: `Store`, hooks, tracker, handler stack), `packages/ui/src/jsx-runtime.ts`, `packages/ui/src/string.ts`, `packages/ui/src/index.ts`, `packages/ui/package.json` (dependency on `@sleekstack/core`), `packages/ui/src/__tests__/reactive.test.ts` (new)
**Touches:** [packages/ui/src/node.ts, packages/ui/src/reactive.ts, packages/ui/src/jsx-runtime.ts, packages/ui/src/string.ts, packages/ui/src/index.ts, packages/ui/package.json, packages/ui/src/__tests__/reactive.test.ts]

### Approach
- Add the `Reactive` variant `{ atoms, child, rerun }` to the `Node` union (`packages/ui/src/node.ts:20-26`); the spec's API Contracts shape is the whole contract.
- `reactive.ts`: `Store` is `Effect.Tag('Store')` over `AtomStore` (`packages/core/src/atom/AtomStore.ts:28`). A tracker is an optional service read with `Effect.serviceOption`/a `Context.Reference` with a default, so hooks called outside a wrapped instance return the value untracked and add no requirement beyond `Store`. `useAtomValue` records the atom on the current collector and reads `store.get`; `useSetAtom` records nothing; `useAtom` pairs them.
- Hooks fail with a tagged error naming `Store` when no store is in context (R6 Errors), never a throw.
- Wrapper in `jsx` (`packages/ui/src/jsx-runtime.ts:35-40`): for function types run `type(props)` under a fresh collector and `Effect.context` capture; no atoms read means return the plain node; otherwise return `Reactive` whose `rerun` is the same wrapped run provided with the captured context. `Fragment`, `Provider` and `Boundary` stay as they are.
- `Boundary` also pushes `{ tag, fallback }` on a handler stack held in a `Context.Reference` (default empty), around its children, so a captured context carries its enclosing handlers (spec Architecture, Failure bullet).
- String renderer (`string.ts:25-50`): serialize the `Reactive` node's `child`, no wrapper element, no subscription; `renderToString` runs under a fresh `makeAtomStore()` provided as `Store`, disposed afterwards.
- `sleek-reactive` is renderer-written only: reject a user-built element of that name where `checkName` runs (`string.ts:15-24`).

### Investigation targets
**Required** (read before coding):
- `packages/ui/src/node.ts`, `packages/ui/src/jsx-runtime.ts`, `packages/ui/src/string.ts`, `packages/ui/src/component.ts:34-62`
- `packages/core/src/atom/AtomStore.ts:14-72` — `makeAtomStore`, `get`, `dispose`
**Optional**:
- `packages/ui/src/__tests__/string.test.ts` — test pattern

### Key context
The collector must be per component instance and scoped to that instance's own run, not its children's: children are separate `jsx` calls with their own collectors. A component that reads no atom must return exactly the node it returned before this change (existing tests are the pin).

## Acceptance
- [ ] A component using `useAtomValue` renders the atom's current value under `renderToString`, with no wrapper element in the output, and a first-render failure rejects with the original tagged error
- [ ] A `Provider` layer enclosing the component is visible to its render
- [ ] Hooks called without a store fail with a tagged error naming `Store`; hooks called on a directly-invoked component return the value untracked
- [ ] Components that read no atom produce byte-identical output to before (existing `string.test.ts` and `dom.test.ts` stay green)
- [ ] A user-built `sleek-reactive` element is rejected; `pnpm --filter @sleekstack/ui typecheck` and tests pass

## Done summary
Added `Store`, `useAtomValue`/`useSetAtom`/`useAtom`, the per-instance JSX wrapper (`instance`) returning a `Reactive` node with a context-capturing `rerun`, the Boundary handler stack, per-run `RenderScope` so Provider layers survive reruns and superseded runs release them, string rendering of `Reactive` under a fresh store, and `sleek-reactive` rejection (string and DOM). Tests: packages/ui/src/__tests__/reactive.test.ts.

Outside declared Touches (required for typecheck/analyzer gates): packages/ui/src/dom.ts (Reactive case renders child; checkTag), packages/analyze/src/components.ts (ReactiveNode accepted in Node member regex), pnpm-lock.yaml. Task .2 must provide `RenderScope` (a mount scope) and `Store` in `mount`.

stage: impl-review - ran (codex: NEEDS_WORK x2 -> SHIP)
Tier: opus at medium
## Evidence
- Commits: 1a621eebeee2aa6dec74df6b6311ab4e81fbc28a, 821415738f80585b430679c2570c50249cd5c4ca, 4e5091a7330eddc2a788a80f72ee616fcdf923cd
- Tests: pnpm --filter @sleekstack/ui test, pnpm --filter @sleekstack/ui typecheck, pnpm --filter @sleekstack/analyze test, cd apps/ui-demo && npx vitest run && npx tsc --noEmit
- PRs: