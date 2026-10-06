---
satisfies: [R1]
---
# fn-24-pending-async-boundaries-for.1 ui: Pending core (instance + slot handle + content scope), first run shows fallback then content

## Description
Early proof point. Builds `Pending` as a component instance whose content fiber runs in a scope the Pending instance owns, separate from the body-run scope, and settles the three design problems the spec's Planning decisions list (scope ownership, re-run vs fork, slot commit with async content) before anything else is built.

**Size:** L
**Files:** packages/ui/src/pending.ts (new), packages/ui/src/reactive.ts, packages/ui/src/node.ts, packages/ui/src/jsx-runtime.ts, packages/ui/src/dom.ts, packages/ui/src/index.ts, packages/ui/src/__tests__/pending.test.tsx (new)
**Touches:** [packages/ui/src/pending.ts, packages/ui/src/reactive.ts, packages/ui/src/node.ts, packages/ui/src/jsx-runtime.ts, packages/ui/src/dom.ts, packages/ui/src/index.ts, packages/ui/src/__tests__/pending*]

### Approach
- Declare `Pending` in jsx-runtime.ts (the analyzer resolves `ui/jsx-runtime#Pending`) and keep it OFF the direct-call list in `jsx()` so it goes through `instance()` and gets an id, key and slots; re-export from index.ts like Boundary/Provider.
- Children are `Child` Effects: run them inside the forked content fiber, never eagerly in `jsx()`, or the content runs before the fallback can show.
- The Pending slot reads unconditionally (a Pending with no atom reads and no key must still be a `Reactive`). Pending's own state is one slot handle holding `{ phase, content }`; `content` is an opaque single-ownership handle (node + scope + frame), moved not copied, so `adopt`/`swap` never close a scope that is still in use.
- Body distinguishes a slot-set re-run (emit the stored node, no fork) from a fresh run (fork content): record the discriminator in the code comment.
- Content gets its own frame and slot subtree; `commitSlots`/`dropSlots` for content slots happen at content commit, not at the Pending run's commit.
- Expose `{ fallback, content }` as an optional `pending` field on `ReactiveNode` (no new Node kind); task 3 consumes it.
- Fallback runs through the same scoped path as a Boundary fallback and its scope closes when content commits.

### Investigation targets
**Required** (read before coding):
- `packages/ui/src/reactive.ts` instance()/useLocal/commitSlots/dropSlots/runScopes (post-fn-23)
- `packages/ui/src/dom.ts` build 'Reactive', adopt, swap, kill, closeScope (~l.262, 340-360, 455-507)
- `packages/ui/src/jsx-runtime.ts` jsx() direct-call list
- `packages/ui/src/__tests__/reactive-dom.test.ts` jsdom patterns for scope lifecycle
- `.flow/specs/fn-24-pending-async-boundaries-for.md` Planning decisions

## Acceptance
- [ ] First run renders `fallback`, then content in the same DOM position, in a jsdom test using a controllable promise (R1).
- [ ] A slot-set re-run emits the stored content without forking again and without closing its scopes (test asserts a fork counter and scope-closed flags).
- [ ] A Pending with no key and no atom reads is still a keyed-capable `Reactive` instance; nested `useLocal` state under content survives a parent re-run.
- [ ] Existing ui tests pass; `pnpm turbo run test typecheck --filter=@sleekstack/ui...` green.

## Done summary
Added `Pending` (packages/ui/src/pending.ts): an instance whose content forks in a daemon fiber with its own scope, frame and slot subtree (`content` kid of the Pending's slots). The resolved content moves into a useLocal slot as `{node, frame, props}`; the props-identity discriminator separates a slot-set re-run (emit stored node, no fork) from a fresh run (fork). Previous content stays on screen during a re-fork. dom.ts: re-emitted nodes adopt idempotently, untracked scopes still in the new set stay open, content slots commit with the run, and dropScopes leaves uncommitted content to its Pending. `pending: {fallback, content, frame?}` rides on ReactiveNode.
Follow-ups (fn-24.2): content failure is dropped (no error routing yet); stale-fork completion is ignored; one scope closer per fork accumulates in the content slots until dispose.

baseline: green
stage: impl-review - skipped(config: REVIEW_MODE=none)
Tier: implementer: opus at medium (project routing block)
## Evidence
- Commits: 348ad076721299c35338daaa73412f27aa3b0675
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui...
- PRs: