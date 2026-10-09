# Code splitting with lazy

## Conversation Evidence

> user (turn 1): "Plan next steps toward closing the gap with react, also include some of community standards that is used in React today built-in and batteries included, and design as if knowing the frontend and react community now what would the creators do and how would they design it in hindsight"
> user (turn 2): "chart each one and save them"
> user (turn 3): "Aske me the decisions"

Chart evidence (links, untagged): chart fn-38, briefing B1; decisions [fn-38.D1](.flow/charts/fn-38/1.md).

## Goal & Context

<!-- Goal & Context: 50% [paraphrase], 50% [inferred] -->

Large apps need code splitting. A probe in this chart showed that a thin wrapper over a dynamic import works under `Pending` in the string renderer, the DOM renderer and hydration, with no renderer change. This spec ships `lazy`. Decision in chart fn-38 (D1).

## Architecture & Data Models

- `lazy(load)` returns a component that waits for the import under `Pending` and then renders the loaded component. The module is cached per `load`, so a re-run does not import again. See fn-38.D1.

## Edge Cases & Constraints

- The string renderer must await the import; the stream renderer flushes the fallback first, as for any pending content.
- Hydration must adopt the server node without a flash (confirmed by the probe).
- A failed import is an error for the nearest `Boundary`.

## Acceptance Criteria

- **R1:** `lazy(() => import(...))` is a component that shows the `Pending` fallback until the module loads, then the loaded component. [paraphrase]
- **R2:** The string renderer output contains the loaded content, and `hydrateMount` adopts the server nodes without replacing them. [paraphrase]
- **R3:** A re-run does not import the module again. [inferred]
- **R4:** A failed import reaches the nearest `Boundary`, or `onError` when none matches. [inferred]
- **R5:** Chunk splitting works with the repo's bundler setup, and the ADR 0022 size budget is checked and not exceeded without a recorded decision. [inferred]
- **R6:** The ui README documents `lazy` with one example. [inferred]

## Boundaries

- Not in scope: route-level splitting (router) and preloading. [inferred]

## Decision Context

- Chart fn-38 / briefing B1: [fn-38.D1](.flow/charts/fn-38/1.md).
- Part of the React-gap roadmap.

## Requirement coverage

| R-ID | Owner |
| --- | --- |
| R1 | fn-N.M (TBD - populate via /flow-next:plan) |
| R2 | fn-N.M (TBD - populate via /flow-next:plan) |
| R3 | fn-N.M (TBD - populate via /flow-next:plan) |
| R4 | fn-N.M (TBD - populate via /flow-next:plan) |
| R5 | fn-N.M (TBD - populate via /flow-next:plan) |
| R6 | fn-N.M (TBD - populate via /flow-next:plan) |
