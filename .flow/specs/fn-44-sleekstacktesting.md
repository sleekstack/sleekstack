# @sleekstack/testing

## Conversation Evidence

> user (turn 1): "Plan next steps toward closing the gap with react, also include some of community standards that is used in React today built-in and batteries included, and design as if knowing the frontend and react community now what would the creators do and how would they design it in hindsight"
> user (turn 2): "chart each one and save them"
> user (turn 3, selected): "Testing Library compatible (Recommended)"
> user (turn 4): "run capture on all"

Chart evidence (links, untagged): chart fn-40, briefing B1; decisions [fn-40.D1](.flow/charts/fn-40/1.md), [fn-40.D2](.flow/charts/fn-40/2.md).

## Goal & Context

<!-- Goal & Context: 50% [paraphrase], 50% [inferred] -->

React developers test components with a render helper and Testing Library queries. Host components in @sleekstack/ui have no equivalent: each test repeats the same setup (act mode, mount, disposal, waiting for async runs). This spec adds a small testing package that renders a host component with a mock Layer and works with Testing Library queries and user-event. Decisions are in chart fn-40 (D1, D2).

## Architecture & Data Models

- A `render` helper mounts a host component with a given Layer and Store, enables React's act environment, and registers disposal so tests need no cleanup code. See fn-40.D2.
- A `flush` helper waits for pending re-runs and post-commit effects.
- A mock-Layer helper builds a Layer from partial service implementations.
- Queries are not built in: tests use Testing Library's DOM queries and user-event on the container. See fn-40.D1.

## Edge Cases & Constraints

- Testing Library and user-event are dependencies of the user's tests, not of this package.
- Must work under Vitest with jsdom, covering mount, hydration, streaming output, effects and refs.
- Disposal must not leak between tests (stores, effect scopes, guest roots).

## Acceptance Criteria

- **R1:** A host component renders in a test with one call that takes a Layer, and the returned handle exposes the container and a dispose. [inferred]
- **R2:** Testing Library queries (by role and text) and user-event work against the rendered container without adapter code. [paraphrase]
- **R3:** `flush` resolves after pending re-runs and post-commit effects have run, so assertions after it see the settled DOM. [inferred]
- **R4:** Rendered trees are disposed automatically after each test when the test runner supports an after-each hook. [inferred]
- **R5:** A mock-Layer helper provides services from partial implementations, so a test supplies only what the component uses. [inferred]
- **R6:** The package's own tests cover rendering, a click through user-event, an effect cleanup on dispose, and an async component under `Pending`. [inferred]
- **R7:** The ui README or docs describe the package with one example test. [inferred]

## Boundaries

- Not in scope: a custom query API, snapshot tooling, or end-to-end browser testing. [paraphrase]
- Not in scope: a Storybook decorator or recipes for database or auth services (separate queue items). [inferred]

## Decision Context

- Chart fn-40 / briefing B1: query style ([fn-40.D1](.flow/charts/fn-40/1.md)), harness ([fn-40.D2](.flow/charts/fn-40/2.md)).

## Requirement coverage

| R-ID | Owner |
| --- | --- |
| R1 | fn-N.M (TBD - populate via /flow-next:plan) |
| R2 | fn-N.M (TBD - populate via /flow-next:plan) |
| R3 | fn-N.M (TBD - populate via /flow-next:plan) |
| R4 | fn-N.M (TBD - populate via /flow-next:plan) |
| R5 | fn-N.M (TBD - populate via /flow-next:plan) |
| R6 | fn-N.M (TBD - populate via /flow-next:plan) |
| R7 | fn-N.M (TBD - populate via /flow-next:plan) |
