# 0038. Model and Draft: two directions meet at the Model; `toDto` is an Effect; types in core, `useDraft` in ui

## Status

Accepted

## Context

An edit form needs a seed from server data, per-field validation, a dirty flag, a reset, and the body the write endpoint takes. Form Actions (ADR 0033) decode `FormData` on submit, but SleekStack had no contract for the form's state between the seed and the submit. ramcinpay-front has one: `ModelSpec` for the read side, `DraftSpec` for the write side, and `useDraftForm` to bind a Draft to a form library. Its ADR-0005 takes the record-and-checkout idea from EmberData, and its ADRs win over this one where they overlap. This ADR ports the contract and fits it to Effect, atoms and the ui framework.

## Decision

```text
Wire(read) --fromDto(dto, ctx)--> Model --create--> Draft --toDto (Effect)--> Wire(write)
                                    ^                 |
                                    +---- toModel ----+   (preview, or the apply of useOptimistic)
```

- **Two directions meet at the Model.** The read direction is `ModelSpec<Dto, M, Ctx>`: a pure `fromDto(dto, ctx)`, where `ctx` is resolved data only, never a Service or client. The write direction is `DraftSpec<D, Dto, Src, P, E, R>`: `schema(src)`, `create(src)`, `toDto(draft, src)`, and optional `toModel(draft, src)` and `diff(base, next)`. There is no `toDto(model)`: the Model holds labels the client cannot turn back into wire data, and the write body differs from the read one.
- **`toDto` is an Effect** (`Effect<Dto, E, R>`). The ambients it needs (ids, the clock) are Services in `R`, and its failures are typed in `E`. A form action that yields `draft.toDto()` takes both, so `sleekstack check` reports them. ramcinpay's `toDto` is a plain function. `schema`, `create`, `toModel` and `diff` stay pure.
- **Validation is Effect Schema, with Type equal to Encoded** (`Schema.Schema<D, D>`, enforced by the types). A Draft field holds what its input holds, so a number input's field is a string. The schema validates the string and `toDto` converts it. There is no coercion helper. `errors` maps each issue path to its messages, through Effect's `ArrayFormatter`.
- **The Draft is atoms in the component's Store.** `useDraft(spec, src)` is a slot hook, like `useLocal` (`ConditionalSlot` in the Analyzer). It returns one Draft for the instance's life, with the same `field(name)` atoms on every run, and releases the Draft's atoms with the instance. `errors`, `valid`, `dirty`, `preview` and `changes` are derived atoms, computed only when read. Outside a component, `useDraft` returns a new Draft without a slot.
- **The source is a value or an atom, and re-seeds a pristine Draft.** The Draft starts as `spec.create(src)`. `dirty` compares the Draft with its seed by `Schema.equivalence`, not by reference. When the source changes (the atom, or a different value on a later run) and the Draft is pristine, the Draft re-seeds. When it has been edited, it keeps the edits. `reset()` re-seeds from the current source, and another spec on a later run re-seeds too. A value source is compared by structure (plain objects, arrays and `Equal` values) and a spec by its members, so a literal rebuilt on every run is not a change. Writing a new source does not re-run the component that passed it.
- **Types in core, the hook in ui.** `ModelSpec` and `DraftSpec` are type-only exports of `@sleekstack/core`, usable in Kit Operations, server code and tests without `@sleekstack/ui`. `useDraft` and `Draft` are in `@sleekstack/ui`. Core gains no runtime export.
- **It plugs into what exists.** A Form Action yields `draft.toDto()` into the `Result` of `useAction` (a `ParseError` stays there, as does a failure of `toDto`), `useFormStatus` reads its pending state, and `spec.toModel` serves as the `apply` of `useOptimistic`.

## Consequences

- `field(name)` takes a record Draft's data keys (not its methods) or an array Draft's indexes. A primitive Draft has none, so it is written through `value`. A field write copies the Draft (an array stays an array, a class instance keeps its prototype) and sets an own data property, so writing a getter-only property shadows the getter.
- A class instance that is not `Equal` is compared by identity. A new instance passed on every run re-seeds a pristine Draft on every run, so pass an atom or a stable value.
- A spec with no source still takes the argument: `useDraft(Spec, undefined)`, as with ramcinpay's `useDraftForm`.
- `preview` and `changes` always exist at runtime and read `undefined` while the current spec lacks `toModel` or `diff`. In the type, each appears only when every member of the spec type has the method.
- The ADR 0022 size budget holds: the measured entries grew by at most 75 B gzip, and its table is remeasured.

## Rejected

- **`toDto(model)`, or one bidirectional codec (a Schema transform between Model and DTO):** the read Model and the write body are different shapes (ramcinpay ADR-0005).
- **A coercing schema for the Draft (`NumberFromString`):** the field would no longer hold what its input holds. It is a type error.
- **A plain `toDto` function:** the ambients it reads would be hidden from `R` and from the Analyzer.
- **A form-library binding (`useDraftForm` over react-hook-form):** ui forms are Form Actions and atoms.
- **Exported `fromDto`/`toDto` helpers, HTTP or query-cache code, a filters contract, coercion helpers, `<input bind>` JSX sugar, relationships, and a record store as in EmberData:** out of scope. The specs are user code.
