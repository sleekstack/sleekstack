# Model and Draft: an Effect-native read/write contract for data (ported from ramcinpay-front, EmberData-inspired)

## Goal & Context
The ramcinpay-front data layer splits a record's life into two contracts that meet at the **Model**: a read side (`fromDto`) and a write side (`DraftSpec`: `schema`, `create`, `toDto`, optional `toModel` and `diff`), bound to a form by `useDraftForm`. Inspired by EmberData (a record, a mutable checkout of it, save). This spec ports the contract and tailors it to SleekStack: the write side is an Effect with typed errors and requirements (ambients become Services in `R`, visible to the Analyzer), the Draft is atoms in the component's Store with the instance's Scope, validation is Effect Schema, the source can be an Atom, and the pieces plug into the existing Form Action, `useAction`, `useOptimistic` and `Result` rather than a form library.
Reference to port from (read-only; its ADRs win over this text where they overlap): `~/WebstormProjects/ramcinpay-front` (`libs/shared/utils/src/model.ts`, `draft.ts`, `libs/shared/hooks/src/useDraftForm.ts`, `docs/agents/models-fromdto-todto.md`).

```
Wire(read) --fromDto(dto, ctx)--> Model --create--> Draft --toDto (Effect)--> Wire(write)
                                    ^                 |
                                    +---- toModel ----+   (preview, or the `apply` of useOptimistic)
```

## Scope
- Types `ModelSpec` and `DraftSpec` in `@sleekstack/core` (types only: usable in Kit Operations and server code, and in tests, without `@sleekstack/ui`).
- `useDraft(spec, src)` in `@sleekstack/ui`: a slot hook (like `useLocal`, `useDerivedAtom`) returning one Draft per component instance.
- CONTEXT.md terms **Model**, **Draft Spec**, **Draft**; an ADR; README rows; a docs page; a showcase demo.

## Acceptance
- **R1:** `ModelSpec<Dto, M, Ctx = void>` is `{ fromDto(dto, ctx): M }` (pure; `Ctx` is resolved data only, never a Service or client) and `DraftSpec<D, Dto, Src = void, P = never, E = never, R = never>` is `{ schema(src), create(src), toDto(draft, src): Effect<Dto, E, R>, toModel?(draft, src): P, diff?(base, next): Partial<Dto> }`, exported as types from `@sleekstack/core`; `schema` returns an Effect `Schema` whose Type and Encoded are both `D` (draft fields hold what the input holds, so a number input's field is a string), enforced by the types. No new runtime export in core.
- **R2:** `useDraft(spec, src)` returns, for the instance's whole life, one `Draft<D, Dto, P, E, R>` with: `value` (a writable atom of the draft), `field(name)` (a writable atom per field, stable per name), `errors` (an atom of validation issues per field path, computed from `spec.schema(src)` with Effect's issue formatter), `valid`, `dirty`, `reset()`, `toDto()` (an Effect<Dto, ParseError | E, R | Store> that validates with the schema, then runs `spec.toDto(draft, src)`), and `preview` (an atom of `spec.toModel(draft, src)`; in the type only when the spec has `toModel`).
- **R3:** `src` is a value or an Atom of `Src`. The Draft starts as `spec.create(src)`; `dirty` is whether the draft differs from the seed by the schema's equivalence (`Schema.equivalence`), not by reference; edits through `value` or `field(name)` change only the Draft.
- **R4:** Re-seeding (ramcinpay rule, now atom-driven): when the source Atom changes (or a re-run passes a different `src` value) while the Draft is pristine, it re-seeds from `spec.create(src)`; after the user has edited, edits are kept and `dirty` stays true. `reset()` re-seeds from the current source and clears `dirty`. Editing back to the seed makes `dirty` false and does not re-seed.
- **R5:** `diff`, when implemented, is exposed as `changes` (an atom of `spec.diff(seed, draft)`, a minimal PATCH body), in the type only when the spec has `diff`. `errors`, `preview` and `changes` are lazy: nothing is computed per keystroke until something reads them.
- **R6:** `schema`, `create`, `toModel` and `diff` are documented as pure; `toDto` is an Effect so ambients it needs (id generation, clock) are Services in `R` and show up in `sleekstack check` when a handler runs it. No coercion helper: the types make Type equal Encoded, and the docs say to validate the string and convert in `toDto`.
- **R7:** `useDraft` is a slot hook: the Analyzer reports `ConditionalSlot` for a conditional or non-statement call (`checkSlot` list; `slotHooks.test.ts` stays in sync). Outside a component it returns a Draft without a slot (no throw), documented.
- **R8:** Per instance, tied to the instance's Scope: unmount releases the Draft's atoms and subscriptions with no leaked observers; a re-run reuses the same Draft and the same `field(name)` atoms; swapping `spec` on a later run re-seeds it.
- **R9:** It composes with the existing features, shown by tests: a Form Action handler (generator form, ADR 0026) that yields `draft.toDto()` into a `useAction` Result atom (a `ParseError` stays in the Result, a service error from `toDto` too); `useFormStatus` reads its pending state; `spec.toModel` is usable as the `apply` of `useOptimistic(modelAtom, ...)`.
- **R10:** `ModelSpec`, `DraftSpec`, `Draft` and `useDraft` are one public name each across entry points (ADR 0019, `exportNames` test stays green); no `fromDto`/`toDto` helpers are exported (they are user code); the ADR 0022 size budget holds; no other runtime behaviour changes.
- **R11:** Tests cover R1-R9 (seed, edit, dirty by equivalence, reset, pristine re-seed, edited keep, edit-back-to-seed, errors per field, `toDto` success / `ParseError` / service error with a Layer, `preview`, `changes`, lazy members, atom source and value source, unmount cleanup, spec swap, analyzer conditional case) and type tests (`schema` Type must equal Encoded; `field` accepts only keys of D; `preview`/`changes` absent when the spec lacks `toModel`/`diff`; `toDto`'s R and E flow into the handler's type).
- **R12:** CONTEXT.md defines **Model**, **Draft Spec** and **Draft** (with `_Avoid_`: DTO mapper, form state) and credits ramcinpay-front and EmberData; ADR 0038 (next free number) records the decision (two directions meeting at the Model; Effect `toDto` with E/R; Effect Schema; atom source and pristine re-seed; types in core, hook in ui); README rows for core and ui; a short docs page showing a Model, a Draft and a Form Action using `toDto()`.
- **R13:** The showcase has a Model/Draft demo (a Model built with `fromDto(dto, ctx)`, an edit Draft with per-field errors, dirty, reset, a control that changes the source to show pristine re-seed vs dirty keep, a live `preview`, a submit through a Form Action using `toDto()` with its `Result`), working under SSR/hydration where the app does, with a test; the existing task form is switched to it only if that removes code without changing its behaviour.

## Boundaries
- Types plus one hook; no `fromDto`/`toDto` implementation helpers, no HTTP or query-cache code, no filters contract (ramcinpay's ADR-0005 excludes filters too), no coercion.
- No `<input bind>` JSX sugar, no relationships or store.
- Do not hand-edit generated API docs.
