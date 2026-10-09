# fn-40 briefing B1

**Briefing:** B1
**Status:** final
**Chart:** fn-40 - @sleekstack/testing
**Chart status:** done

## Outcome

A test render for host components with mock Layers and queries.

## Notes

- ui-demo tests mount with jsdom [ref: apps/ui-demo/test]

## Decisions

- **fn-40.D1:** Query style - Chosen by the user: Testing Library compatible. `@sleekstack/testing` ships render, flush and mock-Layer helpers; `@t... - [record](.flow/charts/fn-40/1.md)
- **fn-40.D2:** Harness - Vitest + jsdom already covers mount, effects, refs, hydration and streaming; the harness needs only small helpers. - [record](.flow/charts/fn-40/2.md)

## Superseded decisions

(none)

## Ledger (chart)

<!-- the ledger: one line per resolved decision, append-only, D-IDs never reused -->

- **D1:** Chosen by the user: Testing Library compatible. `@sleekstack/testing` ships render, flush and mock-Layer helpers; `@t... -- [record](.flow/charts/fn-40/1.md)
- **D2:** Vitest + jsdom already covers mount, effects, refs, hydration and streaming; the harness needs only small helpers. -- [record](.flow/charts/fn-40/2.md)

## Boundaries

(none)

## Assets

(none)

## Clusters

- **cluster 1:** Single surface: a test render for host components; both decisions share one Outcome - decisions: fn-40.D1, fn-40.D2

## Shared context

(none)
