## Conversation Evidence

- [user] "move Model and Draft out of core into it's own package"
- [user] scope: "Types and useDraft together" (ModelSpec, DraftSpec, useDraft and Draft with its field() method all move)
- [user] name: "@sleekstack/model"
- [user] timing: "Spec now, run after fn-53 merges"

## Goal & Context
<!-- scope: business -->

Model and Draft (ADR 0038) are an optional feature, but their types live in `@sleekstack/core` and their hook lives in `@sleekstack/ui`, so every core and ui user carries them and both packages mention them. They become their own package, `@sleekstack/model`, the way routing is `@sleekstack/router`: `ui` and `core` no longer know the feature exists, and an app opts in by installing it. [paraphrase]

## Architecture & Data Models
<!-- scope: technical -->

- `@sleekstack/model` holds the Model Spec and Draft Spec types, `useDraft`, the `Draft` type and `field()`, with their current behavior (ADR 0038: field-level reads and writes on plain records and arrays only, pristine re-seed from the source, Effect Schema with Type equal to Encoded, lazy `errors`, `preview` and `changes` atoms). [paraphrase]
- `useDraft` is a slot hook: it takes a slot in the running component's frame and reads the `Store`. Outside `ui` it needs a small, documented extension point in `@sleekstack/ui/internal` for packages that define their own slot hooks, which `ui` itself uses for its own hooks. Same boundary as ADR 0025 and 0036: `ui` does not depend on `model`. [inferred]
- The analyzer's conditional-slot rule recognizes slot hooks by where they are defined; it must recognize `useDraft` from its new package, and the sync test that keeps the analyzer's list equal to the ui hooks must cover the external hook too. [inferred]
- `core` loses its Model and Draft exports. Nothing else in `core` depends on them. [inferred]

## API Contracts
<!-- scope: technical -->

- Public names are unchanged (`ModelSpec`, `DraftSpec`, `Draft`, `useDraft`; `field(name)` is a method of `Draft`, not a separate export, and moves with it) and are exported from `@sleekstack/model`; none remain in `@sleekstack/core` or `@sleekstack/ui`. No re-export or alias from the old locations (ADR 0019: one public name, one meaning). [paraphrase]
- The `ui/internal` extension point is documented as unstable, like the rest of that entry. [inferred]

## Edge Cases & Constraints
<!-- scope: technical -->

- Behavior is identical before and after: the Draft runtime tests, the type tests, the showcase demo test and the docs snippets pass with only their import paths changed. [paraphrase]
- `ui`'s published size budget (ADR 0022) is measured again; the Draft code leaves its entry. [inferred]
- `model` must not pull `react` or the router into a bundle that imports only it. [inferred]

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `@sleekstack/model` exports the Model Spec and Draft Spec types, `useDraft` and `Draft` (including its `field(name)` method; master never exported a standalone `field`), and `@sleekstack/core` and `@sleekstack/ui` export none of them. Errors: importing the old names from core or ui is a compile error; the exports-name test (ADR 0019) passes. [paraphrase]
- **R2:** Behavior and types are unchanged: the Draft runtime and type tests move with the code and pass with identical assertions, and the showcase Model/Draft demo and its test pass with only imports changed. Errors: no error surface beyond R1 and the existing assertions. [paraphrase]
- **R3:** `ui/internal` offers the slot-hook extension point that `useDraft` needs, and `ui` has no dependency on `model`. Errors: using the extension point outside a component run fails with the same error as `ui`'s own hooks. [inferred]
- **R4:** `sleekstack check` still reports a conditionally called `useDraft` (and a missing store) exactly as before, with the hook now defined in `@sleekstack/model`; the analyzer/ui sync test covers external slot hooks. Errors: an unrecognized external hook is not reported as a slot hook; a fixture proves both cases. [inferred]
- **R5:** The size budget test shows `ui`'s entry smaller or equal and `model` measured separately. Errors: no error surface beyond the budget check. [inferred]
- **R6:** Docs and records match: the Models guide and its snippets import from `@sleekstack/model`, CONTEXT.md and READMEs name the new package, AGENTS.md has a verify row for it, ADR 0038 is amended by a new ADR recording the move and the extension point, and the docs site typechecks. Errors: no error surface beyond the typecheck. [paraphrase]

## Boundaries
<!-- scope: business -->

- No change to Model and Draft behavior, naming or the `field()` boundary. [paraphrase]
- No compatibility re-exports from `core` or `ui`. [paraphrase]
- Not part of the kit/react/next removal (fn-55); the two can land in either order, but this one starts after fn-53 merges. [user]
- No new form helpers or additions to the package beyond what moves. [paraphrase]

## Decision Context
<!-- scope: both -->

### Motivation
<!-- scope: business -->

Optional features belong in opt-in packages so the base packages stay small and focused; the router already follows this rule, and Model/Draft is the next candidate. [paraphrase]

### Implementation Tradeoffs
<!-- scope: technical -->

A package that defines a slot hook needs access to ui's slot machinery. Rejected: keeping `useDraft` in `ui` with only the types moved (the user chose to move both); rebuilding `useDraft` on ui's public hooks only (risks the pristine re-seed and render-time input write behavior ADR 0038 pins). Chosen: a narrow extension point in `ui/internal`, the same route `query/ui` already uses for `Collector` and `RenderScope`. [paraphrase]


## Quick commands

```bash
pnpm turbo run test typecheck --filter=@sleekstack/model... --filter=@sleekstack/ui... --filter=@sleekstack/analyze --filter=sleekstack --filter=showcase --filter=docs
```

## Early proof point

Task fn-56-model-and-draft-move-to-sleekstackmodel.1 validates the approach (a package outside ui can take slots through `ui/internal` with no behavior change). If it fails, re-evaluate keeping `useDraft` in ui with only the types moved before continuing with .2+.


## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | `@sleekstack/model` exports the Model Spec and Draft Spec types, `useDraft` and `Draft` (including its `field(name)` method; master never exported a standalone `field`), and `@sleekstack/core` and `@sleekstack/ui` export none of them. Errors: importing the old names from core or ui is a compile error; the exports-name test (ADR 0019) passes. | fn-56-model-and-draft-move-to-sleekstackmodel.2 | — |
| R2 | Behavior and types are unchanged: the Draft runtime and type tests move with the code and pass with identical assertions, and the showcase Model/Draft demo and its test pass with only imports changed. Errors: no error surface beyond R1 and the existing assertions. | fn-56-model-and-draft-move-to-sleekstackmodel.2 | — |
| R3 | `ui/internal` offers the slot-hook extension point that `useDraft` needs, and `ui` has no dependency on `model`. Errors: using the extension point outside a component run fails with the same error as `ui`'s own hooks. | fn-56-model-and-draft-move-to-sleekstackmodel.1 | — |
| R4 | `sleekstack check` still reports a conditionally called `useDraft` (and a missing store) exactly as before, with the hook now defined in `@sleekstack/model`; the analyzer/ui sync test covers external slot hooks. Errors: an unrecognized external hook is not reported as a slot hook; a fixture proves both cases. | fn-56-model-and-draft-move-to-sleekstackmodel.3 | — |
| R5 | The size budget test shows `ui`'s entry smaller or equal and `model` measured separately. Errors: no error surface beyond the budget check. | fn-56-model-and-draft-move-to-sleekstackmodel.4 | — |
| R6 | Docs and records match: the Models guide and its snippets import from `@sleekstack/model`, CONTEXT.md and READMEs name the new package, AGENTS.md has a verify row for it, ADR 0038 is amended by a new ADR recording the move and the extension point, and the docs site typechecks. Errors: no error surface beyond the typecheck. | fn-56-model-and-draft-move-to-sleekstackmodel.4 | — |

