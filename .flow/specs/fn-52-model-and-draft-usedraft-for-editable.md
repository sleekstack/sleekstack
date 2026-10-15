# Model and Draft: an editable copy of an atom

## Goal & Context
A form edits a value that lives elsewhere (the Model: a writable atom). Today each form hand-rolls a copy, a dirty flag, a save and a cancel (the showcase task form does). `useDraft(model)` gives a component one Draft: an editable copy of a Model with `dirty`, `commit` and `reset`, as atoms, so the view, form actions and effects read it like any other atom. Nothing in React or Vue ships this as a primitive; it is the part of `v-model`/controlled-input boilerplate that people rewrite every time.

## Scope
- `useDraft(model)` in `@sleekstack/ui`: a slot hook like `useLocal` (statement-level `yield*`, analyzer-enforced).
- CONTEXT.md terms **Model** and **Draft**, an ADR, README row, docs page, and a showcase demo.

## Acceptance
- **R1:** `useDraft(model)` takes a writable atom and returns, for the instance's whole life, one `Draft<A>` with `value` (a writable atom holding the editable copy), `dirty` (an atom: true while `value` differs from the Model's last synced value), `commit()` and `reset()`.
- **R2:** The Draft starts equal to the Model's current value and `dirty` is false. Writing `value` changes only the Draft; the Model is untouched until `commit()`.
- **R3:** `commit()` writes the Draft's value to the Model and clears `dirty`. `reset()` sets the Draft back to the Model's current value and clears `dirty`. Both are plain functions usable as event handlers and from form actions.
- **R4:** While the Draft is clean, a Model change flows into the Draft (it follows the Model). While dirty, a Model change does not overwrite the user's edits, and `dirty` stays true; the next `reset()` or `commit()` resolves it.
- **R5:** Equality uses the same rule as atoms (a write of an equal value emits nothing); a Draft edited back to the Model's value is not dirty.
- **R6:** `useDraft` is a slot hook: the analyzer reports `ConditionalSlot` for a conditional or non-statement call (added to the `checkSlot` list and `slotHooks.test.ts` stays in sync); outside a component it returns a Draft over the given Model without a slot (no throw), documented.
- **R7:** The Draft is per instance: unmounting releases its atoms and subscriptions with no leaked observers; a re-run reuses the same Draft; swapping the `model` argument on a later run follows the new Model and resets the Draft.
- **R8:** `Draft` and `useDraft` are one public name each (ADR 0019); the ADR 0022 size budget holds, and no other package changes behaviour.
- **R9:** Tests cover R1-R7 (start, edit, dirty, commit, reset, follow while clean, hold while dirty, equal-value edit, unmount cleanup, model swap, analyzer conditional case).
- **R10:** CONTEXT.md defines **Model** and **Draft** (with `_Avoid_`: state copy, form state), ADR 0038 records the decision (follow-while-clean, hold-while-dirty, commit/reset as functions), `packages/ui/README.md` has the row, and the docs site has a short page.
- **R11:** The showcase has a Model/Draft demo (an editable profile or task detail: type, see dirty, commit, reset, change the Model elsewhere while clean and while dirty) that works under SSR/hydration where the app does, with a test; the existing task form is switched to it only if that removes code without changing its behaviour.
- **R12:** No error surface beyond existing atom write errors: `commit` of a Model that is not writable is a type error, not a runtime one.

## Boundaries
- One hook and its types; no `<input bind>` JSX sugar, no schema validation inside the Draft (validation stays in form actions with Effect Schema).
- Do not hand-edit generated API docs.
