# fn-36 briefing B1

**Briefing:** B1
**Status:** final
**Chart:** fn-36 - Forms and actions in the ui host
**Chart status:** done

## Outcome

A form submits an Effect/generator action with pending, result and optimistic state as atoms, and works without JS.

## Notes

- Handlers accept functions, generators and Effects [ref: docs/adr/0026-plain-event-handlers.md]

## Decisions

- **fn-36.D1:** Shape of form actions - Chosen by the user after seeing the sketch: a handler on the form. `<form action={handler}>` runs a function, generat... - [record](.flow/charts/fn-36/1.md)
- **fn-36.D2:** Pending, result and optimistic as atoms - Yes: pending, result and optimistic state fit existing atoms; no new machinery needed. - [record](.flow/charts/fn-36/2.md)
- **fn-36.D3:** No-JS submission - Three cases, only two reachable from ui today. - [record](.flow/charts/fn-36/3.md)
- **fn-36.D4:** Validation convention for form actions - Chosen by the user: Effect Schema. FormData is decoded with Effect Schema inside the action and failures become a typ... - [record](.flow/charts/fn-36/4.md)

## Superseded decisions

(none)

## Ledger (chart)

<!-- the ledger: one line per resolved decision, append-only, D-IDs never reused -->

- **D1:** Chosen by the user after seeing the sketch: a handler on the form. `<form action={handler}>` runs a function, generat... -- [record](.flow/charts/fn-36/1.md)
- **D2:** Yes: pending, result and optimistic state fit existing atoms; no new machinery needed. -- [record](.flow/charts/fn-36/2.md)
- **D3:** Three cases, only two reachable from ui today. -- [record](.flow/charts/fn-36/3.md)
- **D4:** Chosen by the user: Effect Schema. FormData is decoded with Effect Schema inside the action and failures become a typ... -- [record](.flow/charts/fn-36/4.md)

## Boundaries

(none)

## Assets

- **fn-36.D1:** path `.flow/charts/assets/fn-36-D1-form-action-sketch.md` - option sketch shown to the user

## Clusters

- **cluster 1:** Single surface: form actions in the ui host; all decisions share one Outcome - decisions: fn-36.D1, fn-36.D2, fn-36.D3, fn-36.D4

## Shared context

(none)
