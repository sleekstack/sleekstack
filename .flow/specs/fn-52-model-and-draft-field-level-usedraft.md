# Model and Draft: field-level editable copies of records (EmberData-inspired)

## Goal & Context
A form edits a value that lives elsewhere (the Model: a writable atom). Today each form hand-rolls a copy, a dirty flag, a save and a cancel (the showcase task form does). `useDraft(model)` gives a component one Draft: an editable copy of a Model record with per-field change tracking, `commit` and `rollback`, as atoms, so the view, form actions and effects read it like any other atom. Inspired by EmberData / WarpDrive: a record, a mutable checkout of it (`checkout`), `hasDirtyAttributes` / `changedAttributes()` per field, `rollbackAttributes()`, and save. We keep the semantics (field-level dirty state, rollback one field or all, edits invisible to the Model until commit) and drop the schema and store machinery: the Model is just a writable atom holding a record.

## Scope
- `useDraft(model)` in `@sleekstack/ui`: a slot hook like `useLocal` (statement-level `yield*`, analyzer-enforced).
- CONTEXT.md terms **Model** and **Draft**, an ADR, README row, docs page, and a showcase demo.

## Acceptance
- **R1:** `useDraft(model)` takes a writable atom holding a record (object) and returns, for the instance's whole life, one `Draft<R>`: `value` (an atom of the whole draft record), `field(name)` (a writable atom for one field, stable per name), `set(name, v)`, `changes` (an atom of the changed fields only, each as `[from, to]` like `changedAttributes()`), `dirty` (an atom: true while any field differs from the Model's last synced value), `rollback(name?)` and `commit()`.
- **R2:** The Draft starts equal to the Model's current record, `changes` is empty and `dirty` is false. Writing a field changes only the Draft; the Model is untouched until `commit()`.
- **R3:** `commit()` writes the Draft's record to the Model and clears `changes`. `rollback(name)` restores one field to the Model's value; `rollback()` restores all fields (like `rollbackAttributes()`). Both are plain functions usable as event handlers and from form actions.
- **R4:** Per field: while a field is clean, a Model change to it flows into the Draft; while it is dirty, a Model change does not overwrite the user's edit and the field stays in `changes` (its `from` shows the Model's newest value); other fields keep following independently.
- **R5:** Equality uses the atom rule per field (writing an equal value emits nothing); a field edited back to the Model's value leaves `changes` and, if it was the last one, `dirty` becomes false.
- **R6:** `useDraft` is a slot hook: the analyzer reports `ConditionalSlot` for a conditional or non-statement call (added to the `checkSlot` list; `slotHooks.test.ts` stays in sync). Outside a component it returns a Draft over the given Model without a slot (no throw), documented.
- **R7:** The Draft is per instance: unmounting releases its atoms and subscriptions with no leaked observers; a re-run reuses the same Draft and the same `field(name)` atoms; swapping the `model` argument on a later run follows the new Model and rolls the Draft back.
- **R8:** `Draft` and `useDraft` are one public name each (ADR 0019); the ADR 0022 size budget holds, and no other package changes behaviour.
- **R9:** Tests cover R1-R7 (start, field edit, changes/dirty, commit, rollback one field and all, follow while clean per field, hold while dirty per field, edit back to equal, unmount cleanup, model swap, analyzer conditional case) and type tests (`field` and `set` accept only keys of the record with the matching value type).
- **R10:** CONTEXT.md defines **Model** and **Draft** (with `_Avoid_`: state copy, form state) and credits the EmberData checkout/changedAttributes inspiration; ADR 0038 (next free number) records the decision (field-level tracking, follow-while-clean, hold-while-dirty, commit/rollback as functions); `packages/ui/README.md` has the row; the docs site has a short page.
- **R11:** The showcase has a Model/Draft demo (an editable profile or task detail: edit fields, see per-field changes and dirty, rollback one field or all, commit, and change the Model elsewhere while a field is clean and while it is dirty) that works under SSR/hydration where the app does, with a test; the existing task form is switched to it only if that removes code without changing its behaviour.
- **R12:** No error surface beyond existing atom write errors: `commit` of a Model that is not writable, and `field`/`set` with an unknown key, are type errors, not runtime ones.

## Boundaries
- One hook and its types; no `<input bind>` JSX sugar, no schema, no relationships or store, no validation inside the Draft (validation stays in form actions with Effect Schema).
- Do not hand-edit generated API docs.
