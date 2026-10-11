# Devtools for ui

## Conversation Evidence

> user (turn 1): "Plan next steps toward closing the gap with react, also include some of community standards that is used in React today built-in and batteries included, and design as if knowing the frontend and react community now what would the creators do and how would they design it in hindsight"
> user (turn 2): "chart each one and save them"
> user (turn 3, selected): "Instance tree (Recommended), Re-run reasons (Recommended), Atoms per instance, Effect runs"
> user (turn 4): "run capture on all"

Chart evidence (links, untagged): chart fn-41, briefing B1; decisions [fn-41.D1](.flow/charts/fn-41/1.md), [fn-41.D2](.flow/charts/fn-41/2.md).

## Goal & Context

<!-- Goal & Context: 60% [paraphrase], 40% [inferred] -->

A developer debugging a host UI cannot see which instances are mounted, why one re-ran, which atoms it owns or when its effects ran. Atoms are already inspectable through the store's read-only snapshot and the existing devtools package; the rest of the renderer is internal. This spec adds an observer on the renderer and panels in the devtools package for four views. Decisions are in chart fn-41 (D1, D2).

## Architecture & Data Models

- The renderer accepts an optional observer and calls it at instance creation, re-run, disposal, slot creation and effect start, restart and cleanup. With no observer attached the cost is nil. See fn-41.D2.
- The observer hands out ids and plain data, never references to live instances, so a disposed instance cannot be retained.
- Four views: instance tree (keys, slots), re-run reasons (atom changed, parent re-run, effect restart), atoms per instance (reusing the store snapshot), effect runs. See fn-41.D1.

## Edge Cases & Constraints

- Observers must not change rendering results or ordering.
- Multiple mounts on one page are distinguishable.
- Server rendering and hydration must work with no observer.

## Acceptance Criteria

- **R1:** With no observer, rendering output and the existing ui tests are unchanged. [inferred]
- **R2:** An attached observer receives events for instance create, re-run (with the reason), dispose and slot creation. [paraphrase]
- **R3:** The observer receives effect start, restart and cleanup events for each effect with an instance id. [paraphrase]
- **R4:** The devtools package shows the live instance tree with keys and slots for a mount. [paraphrase]
- **R5:** The devtools package shows, per instance, the atoms it owns with current values. [paraphrase]
- **R6:** The devtools package shows why an instance re-ran and when its effects ran. [paraphrase]
- **R7:** A disposed instance is released: the observer retains no reference to it (verified by a test). [inferred]
- **R8:** The ui-demo app can open the panels in development. [inferred]

- **R9:** Every observer event carries the id of the mount it came from, so several mounts on a page are distinguishable. [inferred]
- **R10:** A re-run reason names the atom that changed (id or label) and lists all causes when several coalesce into one run. [inferred]
- **R11:** Instances adopted during hydration are reported as a distinct adopt event, not as a create; `resume` adopts no instances (it calls no component), so it has no observer and reports nothing (ADR 0037). [inferred]
- **R12:** The devtools package depends on ui as a peer; ui never depends on devtools. [inferred]
- **R13:** With no observer attached the bench scenarios and the ADR 0022 size budget are unchanged. [inferred]

## Boundaries

- Not in scope: time travel, editing atom values from the panel, or a browser extension. [inferred]
- Not in scope: production telemetry. [inferred]

## Decision Context

- Chart fn-41 / briefing B1: views ([fn-41.D1](.flow/charts/fn-41/1.md)), hook point ([fn-41.D2](.flow/charts/fn-41/2.md)).

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | With no observer, rendering output and the existing ui tests are unchanged. | fn-45-devtools-for-ui.1 | — |
| R2 | An attached observer receives events for instance create, re-run (with the reason), dispose and slot creation. | fn-45-devtools-for-ui.1 | — |
| R3 | The observer receives effect start, restart and cleanup events for each effect with an instance id. | fn-45-devtools-for-ui.2 | — |
| R4 | The devtools package shows the live instance tree with keys and slots for a mount. | fn-45-devtools-for-ui.3 | — |
| R5 | The devtools package shows, per instance, the atoms it owns with current values. | fn-45-devtools-for-ui.3 | — |
| R6 | The devtools package shows why an instance re-ran and when its effects ran. | fn-45-devtools-for-ui.3 | — |
| R7 | A disposed instance is released: the observer retains no reference to it (verified by a test). | fn-45-devtools-for-ui.1 | — |
| R8 | The ui-demo app can open the panels in development. | fn-45-devtools-for-ui.4 | — |
| R9 | Every observer event carries the id of the mount it came from, so several mounts on a page are distinguishable. | fn-45-devtools-for-ui.1 | — |
| R10 | A re-run reason names the atom that changed (id or label) and lists all causes when several coalesce into one run. | fn-45-devtools-for-ui.1 | — |
| R11 | Instances adopted during hydration are reported as adopt, not create; resume adopts no instances and reports nothing. | fn-45-devtools-for-ui.1 | — |
| R12 | The devtools package depends on ui as a peer; ui never depends on devtools. | fn-45-devtools-for-ui.3 | — |
| R13 | With no observer attached the bench scenarios and the ADR 0022 size budget are unchanged. | fn-45-devtools-for-ui.1 | — |
