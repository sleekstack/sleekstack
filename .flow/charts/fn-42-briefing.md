# fn-42 briefing B1

**Briefing:** B1
**Status:** final
**Chart:** fn-42 - Router and data loading for ui
**Chart status:** done

## Outcome

Typed routes, loaders and actions as Effects with Pending and streaming.

## Notes

- RR7 and TanStack Start adapters are queued for React guests [ref: memory queue]

## Decisions

- **fn-42.D1:** Package placement - Chosen by the user: a separate package named `@sleekstack/router` (not `@sleekstack/ui-router`). It stays out of `@sl... - [record](.flow/charts/fn-42/1.md)
- **fn-42.D2:** Loader and action integration - Chosen by the user after seeing the sketch: a route's loader is an Effect run under the Pending the router wraps arou... - [record](.flow/charts/fn-42/2.md)
- **fn-42.D3:** Typed routes as a Layer - Yes, with no codegen: route definitions as a const table, params inferred from path strings, the matched route provid... - [record](.flow/charts/fn-42/3.md)
- **fn-42.D4:** Link prefetch policy - Chosen by the user: prefetch the route code and loader on hover or focus by default; a link sets prefetch={false} to... - [record](.flow/charts/fn-42/4.md)

## Superseded decisions

(none)

## Ledger (chart)

<!-- the ledger: one line per resolved decision, append-only, D-IDs never reused -->

- **D1:** Chosen by the user: a separate package named `@sleekstack/router` (not `@sleekstack/ui-router`). It stays out of `@sl... -- [record](.flow/charts/fn-42/1.md)
- **D2:** Chosen by the user after seeing the sketch: a route's loader is an Effect run under the Pending the router wraps arou... -- [record](.flow/charts/fn-42/2.md)
- **D3:** Yes, with no codegen: route definitions as a const table, params inferred from path strings, the matched route provid... -- [record](.flow/charts/fn-42/3.md)
- **D4:** Chosen by the user: prefetch the route code and loader on hover or focus by default; a link sets prefetch={false} to... -- [record](.flow/charts/fn-42/4.md)

## Boundaries

(none)

## Assets

- **fn-42.D2:** path `.flow/charts/assets/fn-42-D2-loader-sketch.md` - option sketch shown to the user

## Clusters

- **cluster 1:** Single surface: the router, its loaders and actions; one Outcome - decisions: fn-42.D1, fn-42.D2, fn-42.D3, fn-42.D4

## Shared context

(none)
