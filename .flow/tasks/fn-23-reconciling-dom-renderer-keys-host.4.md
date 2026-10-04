---
satisfies: [R1, R2, R3]
---
# fn-23-reconciling-dom-renderer-keys-host.4 ui dom: Live tree and two-phase patch for elements, text, fragments, keys and form controls

Touches: packages/ui/src/dom.ts, packages/ui/src/__tests__/reactive-dom.test.ts, packages/ui/src/__tests__/dom.test.ts

## Description
The core of the spec: replace the `replaceChildren` swap with a plan/apply reconciler over a `Live` tree (spec Architecture: Live tree, Two-phase patch, Matching rules). This task covers elements, text, fragments, key matching and form controls; reactive instance adoption and guest persistence follow in later tasks, so keep their current build/kill behavior working through the new `Live` shape in the meantime.

**Size:** L (the largest task; do not widen it)
**Files:** `packages/ui/src/dom.ts`, `packages/ui/src/__tests__/reactive-dom.test.ts`, `packages/ui/src/__tests__/dom.test.ts`
**Touches:** [packages/ui/src/dom.ts, packages/ui/src/__tests__/reactive-dom.test.ts, packages/ui/src/__tests__/dom.test.ts]

### Approach
- Introduce `Live` (kind, tag, last attrs, key, DOM node(s), child `Live`s) and build it from `Node` + the DOM `build()` creates, never from DOM alone (keeps hydration possible later). Replace `swap`'s tail (`inst.host.replaceChildren`) with plan then apply.
- Plan: diff, create new DOM aside, run `checkTag` / `checkAttr` (reuse from `string.ts`), report `DuplicateKey` once per patch through `onError`, treat the later duplicate as unkeyed. No live DOM or `Live` mutation. Apply: only infallible ops (`setAttribute` / `removeAttribute`, `value` / `checked` properties, `insertBefore` with explicit reference node, `remove`, `nodeValue`).
- Matching rules from the spec: flatten `Fragment`s into the parent's list, key then kind/type, unkeyed by position from a separate pool, `Reactive` by id (adoption comes next task; here a matched id may simply rebuild).
- Form controls: assign properties only when they differ; `<select>` value after options; save/restore `document.activeElement` and selection when a keyed move displaced focus. Skip LIS / `moveBefore` (out of scope).
- Keep `runScopes` / `fallbacks` handling and `release` / `kill` semantics (epoch, `queued`, latest-wins) as they are.

### Investigation targets
**Required**:
- `packages/ui/src/dom.ts:30-100` (owners, kill, teardown), `:110-157` (`build`), `:164-240` (`watch`, `rerun`, `swap`)
- `packages/ui/src/__tests__/reactive-dom.test.ts:10-29,156-181` (helpers; the defect-keeps-old-DOM pattern for the R2 test)
- `packages/ui/src/string.ts:16-30` (`checkTag`, `checkAttr`)
- memory: generation token re-mount must tear down before await; reactive run scopes must follow committed DOM
**Optional**:
- `packages/ui/src/__tests__/dom.test.ts` (innerHTML-assert style)

### Acceptance
- [ ] jsdom: a text/attribute change keeps the same DOM node; a focused attached `<input>` keeps `activeElement` and typed `value` when an unrelated sibling changes; a tag change replaces.
- [ ] A plan-phase failure (bad tag) leaves the live DOM byte-identical and leaks no guest root or scope; a run superseded mid-plan is dropped with its scopes closed.
- [ ] Keyed reorder keeps node identity for every kept key; insert/remove touch only the difference; mixed keyed/unkeyed and duplicate keys behave as specified (`DuplicateKey` once).
- [ ] All existing reactive/dom tests pass (the old guest-remount assertions, if any, are updated in the guest task, not here).

## Acceptance
- [ ] TBD

## Done summary
The DOM renderer now reconciles through a `Live` tree with a plan/apply patch (dom.ts): elements and text patch in place, fragments are flattened, keyed and unkeyed children use separate pools, `DuplicateKey` reports once per patch, and form-control `value`/`checked` are set as properties only when the node's value changed. Carry-overs: `mount`/`renderToString` provide a root `Frame` (root slots disposed with the mount), and keyed calls no longer consume the unkeyed ordinal (reactive.ts).

Behavior change: the old `nested` test asserted the outer `<span>` was replaced on an outer re-run. It now asserts the span survives (R1).
Out of scope, as planned: `Reactive` instances and guests are always rebuilt (tasks .5/.6). Slot commit for non-root re-runs is not wired, because the instance's run frame is not exposed to the renderer.
Bench: one run, every case OK (jsx-overhead 3.152 / 3.227, render-dom mount 1.666, update-1-of-1k 0.425, atoms/diamond 0.223). No re-run was needed.

Tier: session (jev-unavailable(no_key)); routing block pins implementer opus at medium
stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: 88e767ea1f10e94712d08c87e7c6b38904ae3b29
- Tests: pnpm --filter @sleekstack/ui test && pnpm --filter @sleekstack/ui typecheck, pnpm --filter bench bench:json && pnpm --filter bench compare, baseline: green via handoff (verified at ce8c65c by fn-23-reconciling-dom-renderer-keys-host.3)
- PRs: