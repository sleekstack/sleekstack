# Transitions and deferred atoms

## Conversation Evidence

> user (turn 1): "Plan next steps toward closing the gap with react, also include some of community standards that is used in React today built-in and batteries included, and design as if knowing the frontend and react community now what would the creators do and how would they design it in hindsight"
> user (turn 2): "chart each one and save them"
> user (turn 3, selected): "Derived atom with lag (Recommended)"
> user (turn 4): "Aske me the decisions"

Chart evidence (links, untagged): chart fn-37, briefing B1; decisions [fn-37.D1](.flow/charts/fn-37/1.md), [fn-37.D2](.flow/charts/fn-37/2.md).

## Goal & Context

<!-- Goal & Context: 50% [paraphrase], 50% [inferred] -->

React users expect `startTransition` and `useDeferredValue` to keep the UI responsive. Here `Pending` already keeps old content while a re-run resolves, and there are no priority lanes. This spec adds a transition scope on top of that and a deferred atom, without a scheduler. Decisions are in chart fn-37 (D1, D2).

## Architecture & Data Models

- `startTransition(write)` applies an atom write and marks the re-runs it triggers so a `Pending` they pass through keeps the old content instead of showing its fallback. It is a flag carried by those re-runs, not a scheduler. See fn-37.D1.
- `useDeferredAtom(source)` returns an atom that follows `source` after the current commit settles; readers of the deferred atom lag behind readers of the source. See fn-37.D2.

## Edge Cases & Constraints

- Without lanes it cannot interrupt a long synchronous render or prioritise urgent input; the docs and ADR state that limit.
- A transition that fails or is superseded must not leave a stale marker on later re-runs.
- Latest run wins, as in `Pending` today.

## Acceptance Criteria

- **R1:** A write inside `startTransition` keeps the previous content of a `Pending` on the triggered re-runs until the new content resolves. [paraphrase]
- **R2:** A write outside a transition shows the fallback exactly as today. [inferred]
- **R3:** A failed or superseded transition leaves no marker on later re-runs. [inferred]
- **R4:** `useDeferredAtom(source)` returns an atom whose value follows `source` after the commit settles, and the instance owns and releases it. [paraphrase]
- **R5:** The deferred atom is created the same way on every run of a component (same slot rule as the other hooks) and the analyzer's slot-hook check covers it. [inferred]
- **R6:** A bench scenario measures a transition and a deferred read, and the ui size budget of ADR 0022 is checked and not exceeded without a recorded decision. [inferred]
- **R7:** An ADR records transition semantics without concurrent lanes and the limit above. [inferred]
- **R8:** The ui README documents both APIs. [inferred]

## Boundaries

- Not in scope: a priority scheduler or interruptible rendering. [inferred]
- Not in scope: `useTransition`'s pending flag beyond what `startTransition` needs, unless planning shows it is cheap. [inferred]

## Decision Context

- Chart fn-37 / briefing B1: [fn-37.D1](.flow/charts/fn-37/1.md), [fn-37.D2](.flow/charts/fn-37/2.md).
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
