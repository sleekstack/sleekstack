# fn-41 briefing B1

**Briefing:** B1
**Status:** final
**Chart:** fn-41 - Devtools for ui
**Chart status:** done

## Outcome

Inspect the live tree, slots, atoms and re-run reasons.

## Notes

- @sleekstack/devtools has atoms and graph panels [ref: packages/devtools/src]

## Decisions

- **fn-41.D1:** What to expose - Chosen by the user: all four views in the first slice: instance tree (keys, slots), re-run reasons, atoms per instanc... - [record](.flow/charts/fn-41/1.md)
- **fn-41.D2:** Hook point - Use an optional observer on the renderer's `Env`; atoms are already inspectable. - [record](.flow/charts/fn-41/2.md)

## Superseded decisions

(none)

## Ledger (chart)

<!-- the ledger: one line per resolved decision, append-only, D-IDs never reused -->

- **D1:** Chosen by the user: all four views in the first slice: instance tree (keys, slots), re-run reasons, atoms per instanc... -- [record](.flow/charts/fn-41/1.md)
- **D2:** Use an optional observer on the renderer's `Env`; atoms are already inspectable. -- [record](.flow/charts/fn-41/2.md)

## Boundaries

(none)

## Assets

(none)

## Clusters

- **cluster 1:** Single surface: ui devtools views and their Env observer hook share one Outcome - decisions: fn-41.D1, fn-41.D2

## Shared context

(none)
