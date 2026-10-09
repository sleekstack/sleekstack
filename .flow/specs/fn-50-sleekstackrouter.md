# @sleekstack/router

## Conversation Evidence

> user (turn 1): "Plan next steps toward closing the gap with react, also include some of community standards that is used in React today built-in and batteries included, and design as if knowing the frontend and react community now what would the creators do and how would they design it in hindsight"
> user (turn 2): "chart each one and save them"
> user (turn 3, selected): "@sleekstack/router"
> user (turn 4, selected): "Loader is an Effect under Pending (Recommended)"
> user (turn 5, selected): "On hover/focus, opt-out (Recommended)"
> user (turn 6): "Aske me the decisions"

Chart evidence (links, untagged): chart fn-42, briefing B1; decisions [fn-42.D1](.flow/charts/fn-42/1.md), [fn-42.D2](.flow/charts/fn-42/2.md), [fn-42.D3](.flow/charts/fn-42/3.md), [fn-42.D4](.flow/charts/fn-42/4.md).

## Goal & Context

<!-- Goal & Context: 50% [paraphrase], 50% [inferred] -->

Apps built on the ui host have no router. This spec adds a separate package, `@sleekstack/router`, with typed routes, loaders and actions as Effects, Pending and streaming. Decisions are in chart fn-42 (D1 to D4).

## Architecture & Data Models

- A separate package keeps `@sleekstack/ui` within its size budget (ADR 0022), like query (ADR 0025). See fn-42.D1.
- A route's loader is an Effect run under the Pending the router wraps around the page and read with `useLoader`. A route's action has the same shape as a form action (chart fn-36). See fn-42.D2.
- Route definitions are a const table with params inferred from path strings, no codegen; the matched route is provided as a Layer around the page. See fn-42.D3.
- Links prefetch the route code and loader on hover or focus by default, with `prefetch={false}` to opt out. See fn-42.D4.

## Edge Cases & Constraints

- Existing open specs fn-28 and fn-32 describe a `ui-router` over TanStack router-core and its loaders. This spec records the user's decision to use the name and package `@sleekstack/router`; planning must reconcile or supersede those specs before building.
- Loaders must work in the string renderer, streaming and hydration.
- Redirect and not-found handling are part of fn-32's scope and must not be duplicated.

## Acceptance Criteria

- **R1:** The router is a separate package named `@sleekstack/router` and `@sleekstack/ui` does not depend on it. [paraphrase]
- **R2:** A route table defines paths, and the params of a path are typed from the path string without code generation. [paraphrase]
- **R3:** The matched route is available to the page as a Layer service. [inferred]
- **R4:** A route's loader is an Effect whose result the page reads with `useLoader`, shown under `Pending` until it resolves. [paraphrase]
- **R5:** A route's action accepts the same function, generator or Effect forms as a form action. [paraphrase]
- **R6:** A link prefetches the route's code and loader on hover or focus unless it sets `prefetch={false}`. [paraphrase]
- **R7:** Server rendering, streaming and hydration produce and adopt the same DOM for a routed page. [inferred]
- **R8:** The relation to open specs fn-28 and fn-32 is resolved in planning, by merging, superseding or splitting scope, before any task starts. [inferred]

## Boundaries

- Not in scope: the React Router 7 and TanStack Start adapters for React guests. [paraphrase]

## Decision Context

- Chart fn-42 / briefing B1: [fn-42.D1](.flow/charts/fn-42/1.md), [fn-42.D2](.flow/charts/fn-42/2.md), [fn-42.D3](.flow/charts/fn-42/3.md), [fn-42.D4](.flow/charts/fn-42/4.md).
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
| R7 | fn-N.M (TBD - populate via /flow-next:plan) |
| R8 | fn-N.M (TBD - populate via /flow-next:plan) |
