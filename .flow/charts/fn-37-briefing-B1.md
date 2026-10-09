# fn-37 briefing B1

**Briefing:** B1
**Status:** final
**Chart:** fn-37 - Transitions without concurrent rendering
**Chart status:** done

## Outcome

useTransition and useDeferredValue equivalents on the atom store and Reconciler.

## Notes

- Pending keeps previous content until the new run resolves [ref: packages/ui/README.md]

## Decisions

- **fn-37.D1:** What keep-old-UI means here - Pending already is the keep-old-UI mechanism; a transition adds scoping, not a new renderer feature. - [record](.flow/charts/fn-37/1.md)
- **fn-37.D2:** useDeferredValue as a lagging derived atom - Chosen by the user after seeing the sketch: `useDeferredAtom(source)` returns an atom that follows `source` after the... - [record](.flow/charts/fn-37/2.md)

## Superseded decisions

(none)

## Ledger (chart)

<!-- the ledger: one line per resolved decision, append-only, D-IDs never reused -->

- **D1:** Pending already is the keep-old-UI mechanism; a transition adds scoping, not a new renderer feature. -- [record](.flow/charts/fn-37/1.md)
- **D2:** Chosen by the user after seeing the sketch: `useDeferredAtom(source)` returns an atom that follows `source` after the... -- [record](.flow/charts/fn-37/2.md)

## Boundaries

- **D3:** out of scope - Cost of transitions is measured during build: add a bench scenario and keep the ADR 0022 size budget

## Assets

- **fn-37.D2:** path `.flow/charts/assets/fn-37-D2-deferred-atom-sketch.md` - option sketch shown to the user

## Clusters

- **cluster 1:** Single surface: transitions and deferred values on atoms; one Outcome - decisions: fn-37.D1, fn-37.D2

## Shared context

(none)
