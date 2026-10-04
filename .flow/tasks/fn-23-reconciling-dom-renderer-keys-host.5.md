---
satisfies: [R5]
---
# fn-23-reconciling-dom-renderer-keys-host.5 ui dom: reactive instance adoption and kill across parent re-runs

Touches: packages/ui/src/dom.ts, packages/ui/src/__tests__/reactive-dom.test.ts

## Description
Nested reactive instances survive their parent's re-run (spec Architecture: Matched instance; Edge Cases: instance removal). Includes the fn-19 regression tests and the fn-21 query-registry check.

**Size:** M
**Files:** `packages/ui/src/dom.ts`, `packages/ui/src/__tests__/reactive-dom.test.ts`
**Touches:** [packages/ui/src/dom.ts, packages/ui/src/__tests__/reactive-dom.test.ts]

### Approach
- When a `Reactive` node matches a live instance by id, adopt: new `rerun`, new atom list (resubscribe, bump epoch, re-check `seen`), new run scope; interrupt the instance's own in-flight fiber; close the previous run scope only after the commit (apply phase). Patch the instance subtree against the new node's `child`.
- Unmatched instances: full kill sequence (fiber, subscriptions, guest roots, child instances, run scopes, local slots via the slot hooks from the useLocal task). Call `commitSlots` / `dropSlots` at the right phase boundaries.
- Keep `fallbacks` (committed `Boundary` fallback keeps its subscriptions) behaving as in `swap`.

### Investigation targets
**Required**:
- `packages/ui/src/dom.ts:37-49,164-240` (`Instance`, `watch`, `rerun`, `swap`)
- `packages/ui/src/__tests__/reactive-dom.test.ts:137` ('nested'), `:227`, `:268` (scope-release tests)
- fn-21's query registry: search `useQuery` in `packages/ui/src` on `origin/master`
- memory: reactive run scopes must follow committed DOM; atom invalidation must track visits

### Acceptance
- [ ] The 'nested' test is rewritten: an outer change no longer recreates the inner instance; no double re-run, no leaked subscription.
- [ ] A matched instance with an in-flight re-run adopts the parent's node and the latest run wins; a removed instance is fully killed (assert fibers, subscriptions, scopes).
- [ ] A `useQuery` / `useMutation` observer inside a matched instance keeps its retain count across adopt and is released on kill (test).
- [ ] Existing fn-19 scope-release tests pass unchanged.

## Acceptance
- [ ] TBD

## Done summary
Matched `Reactive` nodes adopt their live instance by id (rerun, subscriptions, run scope, run frame switch on commit; in-flight re-run interrupted; old scope closes after commit). Reactive nodes now carry their run `frame` (node.ts, reactive.ts carry-over): commit runs `commitSlots`, dropped/failed runs `dropSlots`, kill `disposeSlots` (now idempotent and resetting). `Instance` identity is now the instance's slots so `useMutation` observers survive adoption. Tests: nested rewrite, in-flight adopt + kill, dropped re-run/kill slots, useQuery/useMutation retain across adopt and release on kill.

Out-of-Touches edits: packages/ui/src/node.ts (`frame` field type) and reactive.ts `Instance` value changed from a per-closure object to the slots (needed for the useMutation AC).
Bench: run 1 and 2 showed render-string/list-1k REGRESSED (2.85 vs 1.74) from an onExit wrapper on every run; moved slot-drop into the existing RenderScope onExit, run 3 all OK (2.50).

stage: impl-review - skipped(config: REVIEW_MODE=none)
Tier: session (jev-unavailable(no_key)); routing block pins implementer opus at medium
## Evidence
- Commits: 6e37d99dbb875453cfa8fa938dae778c20326665
- Tests: pnpm --filter @sleekstack/ui test, pnpm --filter @sleekstack/ui typecheck, pnpm --filter bench bench:json && pnpm --filter bench compare
- PRs: