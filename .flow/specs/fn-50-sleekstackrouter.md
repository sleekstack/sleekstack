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

- fn-28 (`ui-router` over TanStack router-core) is closed as superseded; fn-32 (its loaders) is absorbed into this spec. See ADR 0036.
- Loaders must work in the string renderer, streaming and hydration.
- Redirect and not-found handling came from fn-32 and live only here.

## Acceptance Criteria

- **R1:** The router is a separate package named `@sleekstack/router` and `@sleekstack/ui` does not depend on it. [paraphrase]
- **R2:** A route table defines paths, and the params of a path are typed from the path string without code generation. [paraphrase]
- **R3:** The matched route is available to the page as a Layer service. [inferred]
- **R4:** A route's loader is an Effect whose result the page reads with `useLoader`, shown under `Pending` until it resolves. [paraphrase]
- **R5:** A route's action accepts the same function, generator or Effect forms as a form action. [paraphrase]
- **R6:** A link prefetches the route's code and loader on hover or focus unless it sets `prefetch={false}`. [paraphrase]
- **R7:** Server rendering, streaming and hydration produce and adopt the same DOM for a routed page. [inferred]
- **R8:** fn-28 is closed as superseded by this spec, and fn-32's loader, redirect, not-found and server-handler scope is part of it; fn-29 and fn-30 point at `@sleekstack/router`. This was decided before planning. [paraphrase]

- **R9:** Redirect and not-found raised by a loader or action are control flow, not failures, in the DOM, string and stream renderers. [inferred]
- **R10:** A server entry turns a request into a response (rendered page, redirect or not-found). [inferred]
- **R11:** Back and forward navigation and scroll restoration work; a newer navigation interrupts a pending loader (latest wins) and closes its scopes, leaving no leaked observers (from fn-32). [inferred]
- **R12:** Loader data is serializable and reaches the client through the Transfer extension without a refetch. [inferred]
- **R13:** Prefetched loader results are deduplicated and cached for a bounded time, and a prefetch error is silent. [inferred]
- **R14:** An ADR records dropping TanStack router-core for the const-table design. [inferred]
- **R15:** From fn-32 (task 3: loader error and streaming; task 5: status and redirect loop): a typed loader error reaches the nearest `Boundary`; a server loader failure responds with the error status; a redirect loop past a fixed bound fails with a tagged error; streaming a route with a slow loader sends the shell first. [paraphrase]

## Boundaries

- Not in scope: the React Router 7 and TanStack Start adapters for React guests. [paraphrase]

## Decision Context

- Chart fn-42 / briefing B1: [fn-42.D1](.flow/charts/fn-42/1.md), [fn-42.D2](.flow/charts/fn-42/2.md), [fn-42.D3](.flow/charts/fn-42/3.md), [fn-42.D4](.flow/charts/fn-42/4.md).
- Part of the React-gap roadmap.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | The router is a separate package named `@sleekstack/router` and `@sleekstack/ui` does not depend on it. | fn-50-sleekstackrouter.2 | — |
| R2 | A route table defines paths, and the params of a path are typed from the path string without code generation. | fn-50-sleekstackrouter.2 | — |
| R3 | The matched route is available to the page as a Layer service. | fn-50-sleekstackrouter.2 | — |
| R4 | A route's loader is an Effect whose result the page reads with `useLoader`, shown under `Pending` until it resolves. | fn-50-sleekstackrouter.3 | — |
| R5 | A route's action accepts the same function, generator or Effect forms as a form action. | fn-50-sleekstackrouter.4 | — |
| R6 | A link prefetches the route's code and loader on hover or focus unless it sets `prefetch={false}`. | fn-50-sleekstackrouter.4 | — |
| R7 | Server rendering, streaming and hydration produce and adopt the same DOM for a routed page. | fn-50-sleekstackrouter.3 | — |
| R8 | fn-28 is closed as superseded by this spec, and fn-32's loader, redirect, not-found and server-handler scope is part of it; fn-29 and fn-30 point at `@sleekstack/router`. This was decided before planning. | fn-50-sleekstackrouter.1 | — |
| R9 | Redirect and not-found raised by a loader or action are control flow, not failures, in the DOM, string and stream renderers. | fn-50-sleekstackrouter.5 | — |
| R10 | A server entry turns a request into a response (rendered page, redirect or not-found). | fn-50-sleekstackrouter.5 | — |
| R11 | Back and forward navigation and scroll restoration work; a newer navigation interrupts a pending loader (latest wins) and closes its scopes, leaving no leaked observers (from fn-32). | fn-50-sleekstackrouter.5 | — |
| R12 | Loader data is serializable and reaches the client through the Transfer extension without a refetch. | fn-50-sleekstackrouter.3 | — |
| R13 | Prefetched loader results are deduplicated and cached for a bounded time, and a prefetch error is silent. | fn-50-sleekstackrouter.4 | — |
| R14 | An ADR records dropping TanStack router-core for the const-table design. | fn-50-sleekstackrouter.1 | — |
| R15 | fn-32 carry-over: typed loader error to `Boundary`, server error status, bounded redirect loop, streamed shell first. | fn-50-sleekstackrouter.3, fn-50-sleekstackrouter.5 | — |
