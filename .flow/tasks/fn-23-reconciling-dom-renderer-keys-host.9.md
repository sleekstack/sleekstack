---
satisfies: [R8]
---
# fn-23-reconciling-dom-renderer-keys-host.9 analyze: event-closure requirements and errors in the component tree

Touches: packages/analyze/src/components.ts, packages/analyze/src/model.ts, packages/analyze/src/__tests__/components.test.ts, packages/analyze/src/__tests__/fixtures/**

## Description
Host `onXxx` closures contribute to the component tree: their `R` is checked like a child component's `R`; their `E` must be `never` (spec API Contracts).

**Size:** M
**Files:** `packages/analyze/src/components.ts`, `packages/analyze/src/model.ts`, tests/fixtures
**Touches:** [packages/analyze/src/components.ts, packages/analyze/src/model.ts, packages/analyze/src/__tests__/**]

### Approach
- In `jsx()` for host tags, read each `on*` attribute's expression via `attrOf`, take the closure's return type with `effectArgs`, and add a `component`-kind child node whose `requires` is the closure's R and `errors` its E, so `check()` yields `MissingDependency` / `UnhandledError` unchanged.
- A closure's E can never be caught by an enclosing `Catch`: mark these nodes so `check()` ignores the `caught` set for them. Closures passed by reference or built elsewhere are read through their type; an unreadable type (any / unknown / unresolvable) is reported as the existing `Unresolved`, never skipped.
- Keep mount and resume roots separate (fn-18); `ui-clean` is untouched.

### Investigation targets
**Required**:
- `packages/analyze/src/components.ts:40-64,160-227,409-436` (`effectArgs`, `tagName`, `attrOf`, `jsx`, `component`, `check`)
- `packages/analyze/src/model.ts:130-144` (`UiNode`)
- `packages/analyze/src/__tests__/fixtures/ui-react/` (JSX fixture layout)

### Acceptance
- [ ] A closure needing an unprovided Tag reports `MissingDependency` at the closure's line; the same closure under a matching `Provider` is clean.
- [ ] A closure with a non-`never` `E` reports `UnhandledError`, even inside a matching `Boundary`; one that handles it with `Effect.catchTag` is clean.
- [ ] An unreadable closure type reports `Unresolved`.
- [ ] Existing component-pass tests pass unchanged.

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
