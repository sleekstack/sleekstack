# 0031. Host JSX elements are typed per tag

## Status

Accepted. Types the handlers of ADR 0026 and the `ref` of ADR 0028; no runtime change.

## Context

`JSX.IntrinsicElements` accepted any prop on any tag, so a misspelled attribute, a wrong event name or a wrong event payload passed tsc. React users expect per-tag attribute, event and ref types (chart fn-35, D1 to D3).

## Decision

- `IntrinsicElements` maps every HTML tag (from the platform's `HTMLElementTagNameMap`) and every SVG-only tag (from `SVGElementTagNameMap`; a name shared with HTML resolves to HTML) to its props. Attributes come from a hand-written table in `packages/ui/src/jsx-types.ts`: global, per-tag HTML and per-tag SVG.
- Attribute values are primitives, `null` / `undefined` or an atom of those, matching what the renderer writes.
- `class` is the canonical name and `className` is accepted; `for` / `htmlFor` likewise. Each pair is mutually exclusive. `aria-*` and `data-*` are global. A hyphenated tag (custom element) takes any props.
- `on*` props are typed from the element's event map: `currentTarget` is the element, multi-word names are camel-cased. A value is a function, a generator or an Effect (ADR 0026), or a `defineHandler` on bubbling events only. A string is rejected.
- `ref` takes only a `Ref` of the matching element; `Ref` is invariant.
- Type tests live in `packages/ui/src/__tests__/jsx-types.test-d.tsx`, checked by `tsc --noEmit`.

## Consequences

- Attribute and event mistakes fail typecheck (one real one was found in `apps/ui-demo`: `dateTime` instead of `datetime`).
- The attribute table must grow when a platform attribute is missing; it is not generated.
- Without `exactOptionalPropertyTypes`, `class="a" className={undefined}` type-checks; it is harmless (undefined removes the attribute).
