---
satisfies: [R7]
---
# fn-19-reactive-host-subtrees-for-sleekstackui.3 analyze: Store is always provided at mount

## Description
So that components using the hooks check clean (R7): the component pass treats `Store` as provided by every `mount`. Nothing else changes: a hook user missing another Tag, or with an unhandled tagged error, is still reported. R8 (rejection under `resume`) is not in this task: `resume` does not exist until fn-18 lands.

**Size:** S
**Files:** `packages/analyze/src/components.ts`, `packages/analyze/src/__tests__/components.test.ts`, new fixture `packages/analyze/src/__tests__/fixtures/ui-hooks/`
**Touches:** [packages/analyze/src/components.ts, packages/analyze/src/__tests__/components.test.ts, packages/analyze/src/__tests__/fixtures/ui-hooks/**]

### Approach
- In `analyzeComponents`, where each tree's provided set is seeded from the mount layer (`components.ts` `visit`, `check(t.root, new Set(t.provides), ...)`), add the `Store` Tag name to that set. The Tag name is the printed type used by `tagNames`; confirm it from the fixture rather than hard-coding a guess.
- Fixture `ui-hooks`: a component using `useAtomValue` that is clean, plus one that also needs an unprovided Tag (`// @error MissingDependency`) and one with an unhandled tagged error (`// @error UnhandledError`), following the marker convention (`components.test.ts:8-16`).

### Investigation targets
**Required** (read before coding):
- `packages/analyze/src/components.ts` — `visit`, `check`, `tagNames`
- `packages/analyze/src/__tests__/components.test.ts` — fixture conventions
**Optional**:
- `apps/ui-demo/test/fixtures.test.ts`

### Key context
The JSX element type is `Effect<Node, never, never>`, so a component's requirements come from its own return type (ADR 0015 amendment); a hook's `Store` requirement appears there.

## Acceptance
- [ ] A component using `useAtomValue` under a `mount` is clean (no `MissingDependency` for `Store`)
- [ ] A hook user that needs another unprovided Tag reports `MissingDependency` at the right file:line; an uncaught tagged error still reports `UnhandledError`
- [ ] Existing component-pass tests and the ui-demo fixtures stay green

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
