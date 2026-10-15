# Model and Draft: the read/write contract for data (ported from ramcinpay-front, EmberData-inspired)

## Goal & Context
The ramcinpay-front data layer splits a record's life into two contracts that meet at the **Model**: a read side (`ModelSpec`: `fromDto(dto, ctx) -> Model`) and a write side (`DraftSpec`: `schema`, `create`, `toDto`, optional `toModel` and `diff`), with `useDraftForm` binding a Draft to a form. Inspired by EmberData (a record, a mutable checkout of it, save). SleekStack gets the same contract with Effect Schema (not Zod) and a ui hook that exposes the Draft as atoms, so the view, form actions (ADR 0033) and effects read it like any other atom. Reference to port from: `~/WebstormProjects/ramcinpay-front` (`libs/shared/utils/src/model.ts`, `draft.ts`, `libs/shared/hooks/src/useDraftForm.ts`, `docs/agents/models-fromdto-todto.md`; its ADRs win over this text if they disagree).

```
DTO(read) --fromDto(dto, ctx)--> Model --create--> Draft --toDto--> DTO(write)
                                   ^                 |
                                   +----- toModel ---+   (optional: live preview / optimistic)
```

## Scope
- Types `ModelSpec<Dto, M, Ctx = void>` and `DraftSpec<D, Dto, Src = void, P = never>` in `@sleekstack/ui` (types only).
- `useDraft(spec, src)`: a slot hook (like `useLocal`) returning one Draft per component instance.
- CONTEXT.md terms **Model** and **Draft**, an ADR, README row, docs page, a showcase demo.

## Acceptance
- **R1:** `ModelSpec<Dto, M, Ctx = void>` is `{ fromDto(dto, ctx): M }` and `DraftSpec<D, Dto, Src = void, P = never>` is `{ schema(src), create(src), toDto(draft, src), toModel?(draft, src), diff?(base, next) }`, both exported as types from `@sleekstack/ui`; `schema` returns an Effect `Schema` whose Type and Encoded are both `D` (draft fields hold what the input holds, so a number input's field is a string), enforced by the types.
- **R2:** `useDraft(spec, src)` returns, for the instance's whole life, one `Draft<D, Dto, P>` with `value` (a writable atom of the draft), `field(name)` (a writable atom for one field, stable per name), `errors` (an atom of validation errors per field path from `spec.schema(src)`), `valid`, `dirty` (the draft differs from `spec.create(src)`), `reset()`, `toDto()` (an Effect that validates with the schema and returns `spec.toDto(draft, src)` or fails with the schema's `ParseError`), and `preview` (an atom of `spec.toModel(draft, src)`, present only when the spec implements `toModel`; absent in the type otherwise).
- **R3:** The Draft starts as `spec.create(src)` with `dirty` false; edits through `value` or `field(name)` change only the Draft.
- **R4:** Re-seeding follows the ramcinpay rule: when `src` changes while the Draft is pristine, it re-seeds from `spec.create(src)`; when it changes after the user has edited, the edits are kept (`dirty` stays true). `reset()` re-seeds from the current `src` and clears `dirty`. Editing back to the seeded value makes `dirty` false and does not re-seed.
- **R5:** `diff`, when implemented, is exposed as `changes()` returning `spec.diff(seed, draft)` (a minimal PATCH body); absent from the type when the spec has no `diff`. `toModel` and `diff` are not called by the hook unless read (no work per keystroke for unread members).
- **R6:** `schema`, `create` and `toModel` are documented as pure; `toDto` may read ambients. No `z.coerce` equivalent: the types make Type equal Encoded, and the docs say to validate the string and convert in `toDto`.
- **R7:** `useDraft` is a slot hook: the analyzer reports `ConditionalSlot` for a conditional or non-statement call (`checkSlot` list, `slotHooks.test.ts` in sync). Outside a component it returns a Draft without a slot (no throw), documented.
- **R8:** Per instance: unmount releases the Draft's atoms and subscriptions with no leaked observers; a re-run reuses the same Draft and the same `field(name)` atoms; swapping `spec` on a later run re-seeds the Draft.
- **R9:** `ModelSpec`, `DraftSpec`, `Draft` and `useDraft` are one public name each (ADR 0019); no `fromDto`/`toDto` helper is exported by the package, they are user code; the ADR 0022 size budget holds; no other package changes behaviour.
- **R10:** Tests cover R1-R8 (seed, edit, dirty, reset, pristine re-seed, edited keep, edit-back-to-seed, validation errors per field, `toDto` success and `ParseError`, `preview`, `changes`, unmount cleanup, spec swap, analyzer conditional case) and type tests (`schema` Type must equal Encoded; `field` accepts only keys of D; `preview`/`changes` absent when the spec lacks `toModel`/`diff`).
- **R11:** CONTEXT.md defines **Model**, **Draft** and **Draft Spec** (with `_Avoid_`: DTO mapper, form state) and credits the ramcinpay-front contract and EmberData; ADR 0038 (next free number) records the decision (two directions meeting at the Model, Effect Schema, pristine re-seed, types in ui); `packages/ui/README.md` has the row; the docs site has a short page showing a Model, a Draft and a form action using `toDto()`.
- **R12:** The showcase has a Model/Draft demo (a Model built with `fromDto(dto, ctx)`, an edit Draft with validation errors, dirty, reset, a pristine/dirty re-seed control, a live `preview`, and a submit through a form action using `toDto()`), working under SSR/hydration where the app does, with a test; the existing task form is switched to it only if that removes code without changing its behaviour.

## Boundaries
- Types plus one hook; no `fromDto`/`toDto` implementation helpers, no HTTP or query-cache code, no filters contract (ramcinpay's ADR-0005 excludes filters too), no schema coercion.
- No `<input bind>` JSX sugar, no relationships or store.
- Do not hand-edit generated API docs.
