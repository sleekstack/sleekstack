# fn-35 briefing B1

**Briefing:** B1
**Status:** final
**Chart:** fn-35 - Typed DOM for @sleekstack/ui
**Chart status:** done

## Outcome

Host JSX elements are typed per tag: attributes, aria/data, class and style, typed ref and typed on* events, with no runtime change.

## Notes

- JSX.IntrinsicElements is `[tag: string]: Props` [ref: packages/ui/src/jsx-runtime.ts]

## Decisions

- **fn-35.D1:** Source of per-tag types - Derive from lib.dom plus one small hand-written table; do not generate from external data. - [record](.flow/charts/fn-35/1.md)
- **fn-35.D2:** class vs className - Chosen by the user: document and type `class`; also accept and type `className` (and `htmlFor` alongside `for`) for R... - [record](.flow/charts/fn-35/2.md)
- **fn-35.D3:** Typed on* events with plain/generator/Effect handlers - Typed events work with a mapped type over `GlobalEventHandlersEventMap`; no runtime change. - [record](.flow/charts/fn-35/3.md)

## Superseded decisions

(none)

## Ledger (chart)

<!-- the ledger: one line per resolved decision, append-only, D-IDs never reused -->

- **D1:** Derive from lib.dom plus one small hand-written table; do not generate from external data. -- [record](.flow/charts/fn-35/1.md)
- **D2:** Chosen by the user: document and type `class`; also accept and type `className` (and `htmlFor` alongside `for`) for R... -- [record](.flow/charts/fn-35/2.md)
- **D3:** Typed events work with a mapped type over `GlobalEventHandlersEventMap`; no runtime change. -- [record](.flow/charts/fn-35/3.md)

## Boundaries

(none)

## Assets

(none)

## Clusters

- **cluster 1:** Single surface (typing of host JSX); all three decisions share one Outcome - decisions: fn-35.D1, fn-35.D2, fn-35.D3

## Shared context

(none)
