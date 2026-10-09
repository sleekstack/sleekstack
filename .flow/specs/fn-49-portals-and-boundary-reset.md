# Portals and Boundary reset

## Conversation Evidence

> user (turn 1): "Plan next steps toward closing the gap with react, also include some of community standards that is used in React today built-in and batteries included, and design as if knowing the frontend and react community now what would the creators do and how would they design it in hindsight"
> user (turn 2): "chart each one and save them"
> user (turn 3, selected): "Fallback receives reset (Recommended)"
> user (turn 4): "Aske me the decisions"

Chart evidence (links, untagged): chart fn-39, briefing B1; decisions [fn-39.D2](.flow/charts/fn-39/2.md).

## Goal & Context

<!-- Goal & Context: 50% [paraphrase], 50% [inferred] -->

Two React staples are missing: rendering into another container (portals) and retrying a failed subtree (error boundary reset). This spec adds a portal that keeps the surrounding Layer context and a `reset` handed to the `Boundary` fallback. Decision in chart fn-39 (D2); how context behaves across a portal is verified during build.

## Architecture & Data Models

- A `Portal` renders its children into a given container while keeping the Layers and Store of where it appears. It renders nothing on the server.
- A `Boundary` fallback receives a `reset`, usable as a function or Effect (wired to a handler); running it re-runs the failed subtree. See fn-39.D2.

## Edge Cases & Constraints

- Context across a portal must hold in the DOM renderer, the string renderer and hydration, and is verified by tests, not assumed.
- A portal's container may disappear; the portal content is disposed with its owner.
- A reset while a previous reset is running does nothing extra (latest run wins).

## Acceptance Criteria

- **R1:** `Portal` renders its children into the given container and keeps the Layers and Store of its position in the tree. [paraphrase]
- **R2:** A test shows services and atoms are readable inside a portal in the DOM renderer, and that the string renderer and hydration do not break. [inferred]
- **R3:** Portal content is removed when the portal or its owner is removed. [inferred]
- **R4:** A `Boundary` fallback can call `reset` to retry the failed subtree; a successful retry replaces the fallback with the content. [paraphrase]
- **R5:** `reset` works as a function and as an Effect in an event handler. [paraphrase]
- **R6:** A failing retry shows the fallback again without leaking the earlier attempt. [inferred]
- **R7:** The ui README documents `Portal` and the fallback's `reset`. [inferred]

- **R8:** `Boundary` becomes a re-runnable instance, and existing hydration and streaming fixtures stay byte-stable (or the change is recorded in an ADR). [inferred]
- **R9:** `reset` also retries a failed lazy import (fn-48 does not cache failures). [inferred]
- **R10:** `reset` called after the boundary is gone does nothing. [inferred]
- **R11:** A Portal whose container is missing or detached fails with a typed error. [inferred]
- **R12:** Portal is handled by every renderer that walks nodes (DOM, hydration, string, stream, resume) and by the analyzer. [inferred]
- **R13:** Handlers inside portal content are client-only, since a portal renders nothing on the server. [inferred]

## Boundaries

- Not in scope: a `resetKey` prop. [paraphrase]
- Not in scope: focus management or accessibility behaviors specific to dialogs. [inferred]

## Decision Context

- Chart fn-39 / briefing B1: [fn-39.D2](.flow/charts/fn-39/2.md).
- Part of the React-gap roadmap.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | `Portal` renders its children into the given container and keeps the Layers and Store of its position in the tree. | fn-49-portals-and-boundary-reset.2 | — |
| R2 | A test shows services and atoms are readable inside a portal in the DOM renderer, and that the string renderer and hydration do not break. | fn-49-portals-and-boundary-reset.2 | — |
| R3 | Portal content is removed when the portal or its owner is removed. | fn-49-portals-and-boundary-reset.2 | — |
| R4 | A `Boundary` fallback can call `reset` to retry the failed subtree; a successful retry replaces the fallback with the content. | fn-49-portals-and-boundary-reset.1 | — |
| R5 | `reset` works as a function and as an Effect in an event handler. | fn-49-portals-and-boundary-reset.1 | — |
| R6 | A failing retry shows the fallback again without leaking the earlier attempt. | fn-49-portals-and-boundary-reset.1 | — |
| R7 | The ui README documents `Portal` and the fallback's `reset`. | fn-49-portals-and-boundary-reset.3 | — |
| R8 | `Boundary` becomes a re-runnable instance, and existing hydration and streaming fixtures stay byte-stable (or the change is recorded in an ADR). | fn-49-portals-and-boundary-reset.1 | — |
| R9 | `reset` also retries a failed lazy import (fn-48 does not cache failures). | fn-49-portals-and-boundary-reset.1 | — |
| R10 | `reset` called after the boundary is gone does nothing. | fn-49-portals-and-boundary-reset.1 | — |
| R11 | A Portal whose container is missing or detached fails with a typed error. | fn-49-portals-and-boundary-reset.2 | — |
| R12 | Portal is handled by every renderer that walks nodes (DOM, hydration, string, stream, resume) and by the analyzer. | fn-49-portals-and-boundary-reset.2 | — |
| R13 | Handlers inside portal content are client-only, since a portal renders nothing on the server. | fn-49-portals-and-boundary-reset.2 | — |
