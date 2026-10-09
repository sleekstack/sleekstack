# Forms and actions in the ui host

## Conversation Evidence

> user (turn 1): "Plan next steps toward closing the gap with react, also include some of community standards that is used in React today built-in and batteries included, and design as if knowing the frontend and react community now what would the creators do and how would they design it in hindsight"
> user (turn 2): "chart each one and save them"
> user (turn 3, selected): "Handler on form (Recommended)"
> user (turn 4, selected): "Effect Schema (Recommended)"
> user (turn 5): "Aske me the decisions"

Chart evidence (links, untagged): chart fn-36, briefing B1; decisions [fn-36.D1](.flow/charts/fn-36/1.md), [fn-36.D2](.flow/charts/fn-36/2.md), [fn-36.D3](.flow/charts/fn-36/3.md), [fn-36.D4](.flow/charts/fn-36/4.md).

## Goal & Context

<!-- Goal & Context: 50% [paraphrase], 50% [inferred] -->

React 19 made form actions, pending state and optimistic updates first-class. Host forms here have only `onSubmit` closures: no decoded form data, no pending state, no validation convention. This spec adds form actions in the ui host, built on the existing handler forms and atoms. Decisions are in chart fn-36 (D1 to D4).

## Architecture & Data Models

- A form's `action` prop accepts a plain function, a generator or an Effect, like any event handler (ADR 0026), and receives the form's decoded FormData. See fn-36.D1.
- Pending, result and optimistic state are atoms: a `Result` atom per form, a derived atom for pending (`useFormStatus`), and a derived atom layered over a source for optimistic values. No new state machinery. See fn-36.D2.
- FormData is decoded with Effect Schema inside the action; a decode failure becomes a typed failure in the `Result`. See fn-36.D4.

## Edge Cases & Constraints

- Submitting without JS needs a server endpoint that ui does not have; only the resumed or hydrated case is in scope. See fn-36.D3.
- The event payload today carries value, checked and key but not FormData; it must gain the form's data for submit events.
- Zod and Valibot are cookbook recipes, not built in.

## Acceptance Criteria

- **R1:** A form's `action` accepts a function, a generator or an Effect, and runs it with the form's FormData on submit. [paraphrase]
- **R2:** A form status derived atom reports pending while the action runs and settles when it ends. [paraphrase]
- **R3:** An action's outcome is a `Result` atom readable by the form and its children: initial, waiting, success or failure. [inferred]
- **R4:** An optimistic value shows immediately and reverts to the source value when the action fails or settles. [inferred]
- **R5:** FormData can be decoded with an Effect Schema inside the action, and a decode failure appears as a typed failure in the `Result`. [paraphrase]
- **R6:** A form whose server HTML was resumed or hydrated submits through its action before and after hydration without a page reload. [inferred]
- **R7:** `sleekstack check` reports an action's error and requirement types the same way as for other handlers. [inferred]
- **R8:** The ui README documents the form action, status and optimistic APIs, and ui-demo has one form using them. [inferred]

## Boundaries

- Not in scope: submission with no JS at all (needs a server endpoint; router chart). [paraphrase]
- Not in scope: built-in Zod or Valibot support. [paraphrase]

## Decision Context

- Chart fn-36 / briefing B1: [fn-36.D1](.flow/charts/fn-36/1.md), [fn-36.D2](.flow/charts/fn-36/2.md), [fn-36.D3](.flow/charts/fn-36/3.md), [fn-36.D4](.flow/charts/fn-36/4.md).
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
