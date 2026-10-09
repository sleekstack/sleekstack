# Typed DOM for @sleekstack/ui

## Conversation Evidence

> user (turn 1): "Plan next steps toward closing the gap with react, also include some of community standards that is used in React today built-in and batteries included, and design as if knowing the frontend and react community now what would the creators do and how would they design it in hindsight"
> user (turn 2): "chart each one and save them"
> user (turn 3, selected): "class, accept className (Recommended)"
> user (turn 4): "run capture on all"

Chart evidence (links, untagged): chart fn-35, briefing B1; decisions [fn-35.D1](.flow/charts/fn-35/1.md), [fn-35.D2](.flow/charts/fn-35/2.md), [fn-35.D3](.flow/charts/fn-35/3.md).

## Goal & Context

<!-- Goal & Context: 50% [paraphrase], 50% [inferred] -->

Host JSX elements are untyped today: any tag accepts any prop, so a misspelled attribute, a wrong event name or a wrong event payload is not caught by tsc. React developers expect per-tag attribute, event and ref types. This spec types host elements without changing runtime behavior. The typing source and naming are decided in chart fn-35 (D1 to D3).

## Architecture & Data Models

- Per-tag types derive from the platform's own DOM typings plus one small hand-written attribute table (names differ from DOM property names and the runtime sets attributes as strings). No external generated data. See fn-35.D1.
- Events are typed from the platform's event map; their payload is the real event type with `currentTarget` narrowed to the element. Handler forms stay those of ADR 0026: a plain function, a generator, or an Effect value, with `E` and `R` left open because the analyzer, not tsc, checks them. See fn-35.D3.
- `aria-*` and `data-*` attributes are accepted on every element.
- `ref` accepts a `useRef` box typed to the element.

## Edge Cases & Constraints

- Event keys are written `onClick` style; the runtime lowercases the part after `on`, so the types must use that casing.
- `style` objects are not supported at runtime today; typing `style` as an object needs a runtime change and is out of this spec.
- Unknown (custom) tags and web components must stay usable.

## Acceptance Criteria

- **R1:** A host element's attributes are checked per tag: an unknown attribute or a wrong value type on a known tag is a type error. [inferred]
- **R2:** `class` is the documented and typed name for CSS classes, and `className` is also accepted and typed; likewise `for` and `htmlFor`. [paraphrase]
- **R3:** `on*` props are typed by event: the handler's parameter is the real event with `currentTarget` narrowed to the element, and a wrong member access is a type error. [inferred]
- **R4:** An `on*` prop accepts a plain function, a generator function or an Effect value, and does not constrain their error or requirement types. [paraphrase]
- **R5:** `ref` on a host element accepts a `useRef` box of the matching element type, and a box of a different element type is a type error. [inferred]
- **R6:** `aria-*` and `data-*` attributes are accepted on every host element. [inferred]
- **R7:** Existing code in the repo that uses host JSX (ui-demo, showcase, tests) type-checks, with any real mistakes it exposes fixed. [inferred]
- **R8:** No runtime behavior changes; the existing ui test suite passes unchanged. [paraphrase]
- **R9:** The ui README documents `class` and the typed attributes, events and refs. [inferred]

## Boundaries

- Not in scope: `style` as an object (runtime change), `className`-only or `class`-only variants, generating types from external data. [paraphrase]
- Not in scope: typing a component's own props, or JSX expression `E`/`R` (the analyzer owns those). [inferred]

## Decision Context

- Chart fn-35 / briefing B1: type source ([fn-35.D1](.flow/charts/fn-35/1.md)), naming ([fn-35.D2](.flow/charts/fn-35/2.md)), event typing ([fn-35.D3](.flow/charts/fn-35/3.md)).
- Parent roadmap: Phase 1 item 1 of the React-gap plan; typed forms (chart fn-36) build on this.

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
| R9 | fn-N.M (TBD - populate via /flow-next:plan) |
