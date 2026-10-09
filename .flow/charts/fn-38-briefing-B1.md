# fn-38 briefing B1

**Briefing:** B1
**Status:** final
**Chart:** fn-38 - Code splitting with lazy
**Chart status:** done

## Outcome

lazy(() => import(...)) components render under Pending in the DOM, string and streaming renderers.

## Notes

- renderToStream flushes Pending fallbacks then chunks [ref: docs/adr/0023-streaming-ssr-protocol.md]

## Decisions

- **fn-38.D1:** Async component under Pending - Works in all three renderers with a thin wrapper; no renderer change. - [record](.flow/charts/fn-38/1.md)

## Superseded decisions

(none)

## Ledger (chart)

<!-- the ledger: one line per resolved decision, append-only, D-IDs never reused -->

- **D1:** Works in all three renderers with a thin wrapper; no renderer change. -- [record](.flow/charts/fn-38/1.md)

## Boundaries

- **D2:** out of scope - lazy bundle size is measured during build: check chunk splitting and the ADR 0022 size budget

## Assets

(none)

## Clusters

- **cluster 1:** Single surface: lazy components under Pending; one Outcome - decisions: fn-38.D1

## Shared context

(none)
