# 0046. `@sleekstack/ui`: void elements without closing tags

## Status

Accepted. Built in spec fn-59 (task 1). `Head`, the stream head patch and hydration adoption are ADR 0044 and fn-33, not this ADR.

## Context

`renderToString` wrote `<meta ... ></meta>` for void elements, which browsers parse as a stray close tag.

## Decision

`area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`, `link`, `meta`, `source`, `track` and `wbr` serialize without a closing tag. Children on a void element throw a `TypeError`, which rejects the render like any invalid element. The list is one regex in `string.ts`'s `serialize`, not a Set, to stay inside the size caps; `renderToString` and `renderToStream` share it.

## Rejected

- **Silently dropping children of a void element:** it hides a bug in the component.

## Consequences

The string and stream renderers agree with the DOM parser on void tags. The size cost is in ADR 0022.
