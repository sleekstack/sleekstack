## Goal & Context
<!-- scope: business -->

`@sleekstack/ui` components are `Effect`s, so they can already be async, but the renderer has no notion of "not ready yet": a component that awaits (a `useQuery` miss, a lazy import) blocks its whole subtree. Production apps need a loading boundary. This spec adds `<Pending fallback={…}>` for the DOM renderer and `renderToString`. Second in the plan after fn-23 (the reconciler); it builds on the Live tree.

## Architecture & Data Models
<!-- scope: technical -->

- `Pending` is a boundary component, parallel to `Boundary` (JSX form of `Catch`): its children run as a forked fiber under the instance; until the first result it renders `fallback`, then the reconciler swaps in the result (keyed/positional matching, no remount of an already-ready sibling).
- A re-run that goes pending again keeps the previous content on screen (no flash) unless `fallback` is requested via a `mode` prop (open question: default keep-previous vs show-fallback; decide in the first task).
- `renderToString` awaits the children (no fallback in the string) so server output is complete; streaming is a later spec.
- Latest-wins interruption (fn-19) applies: a superseded pending run is interrupted and its scopes closed.
- Analyzer: a `Pending` boundary does not remove a child's `R` or `E`; it only models "not ready". Decide whether `Pending` without an enclosing error `Boundary` needs a rule (open question).

## API Contracts
<!-- scope: technical -->

`Pending(props: { fallback: Child; children?: Child }): Element`, exported from `@sleekstack/ui` and the JSX runtime.

## Edge Cases & Constraints
<!-- scope: technical -->

Nested `Pending` (innermost wins); `Pending` inside a keyed list; unmount while pending (fiber interrupted); child failure while pending goes to the error path unchanged; fallback itself must not suspend.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** A child that takes time renders `fallback` first and then its result, in the same DOM position, in jsdom tests with a controllable promise.
- **R2:** A re-run that goes pending again keeps previous content (default) and never renders `fallback` for an already-resolved boundary; behavior is covered by a test.
- **R3:** Unmounting or superseding while pending interrupts the fiber and closes scopes; no listener, subscription or query observer leaks (retain count back to zero).
- **R4:** `renderToString` resolves the children and emits no fallback markup; a failing child still surfaces its typed error.
- **R5:** `apps/ui-demo` shows `Pending` around a `useQuery` list and its test passes; the analyzer stays clean.
- **R6:** ADR 0015 gets an amendment; README and CONTEXT define Pending.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=@sleekstack/analyze`

## Boundaries
<!-- scope: business -->

Not streaming, not hydration, not `use()`-style throwing of promises.

## Decision Context
<!-- scope: both -->

Depends on fn-23 (reconciler). Chosen over fine-grained resources because the framework re-renders and diffs.
