# 0040. Model and Draft move to `@sleekstack/model`; slot hooks outside `ui` go through `ui/internal`

## Status

Accepted. Amends ADR 0038's "Types in core, the hook in ui". Built in spec fn-56.

## Context

Model and Draft (ADR 0038) are optional: most apps on the ui host never write a Draft Spec. Yet `ModelSpec` and `DraftSpec` were exports of `@sleekstack/core` and `useDraft` and `Draft` of `@sleekstack/ui`, so every core and ui user carried them in their API, docs and types. The router already set the rule for an optional feature: its own package that depends on `ui`, never the reverse (ADR 0036).

## Decision

- **One package, `@sleekstack/model`, holds the whole feature:** `ModelSpec`, `DraftSpec`, `Draft` (with its `field(name)` method) and `useDraft`. `@sleekstack/core` and `@sleekstack/ui` export none of them, and nothing re-exports them from the old places (ADR 0019: one public name, one meaning). Behavior is ADR 0038's, unchanged. The package has `sideEffects: false`, peers `effect`, `core` and `ui`, and no `react` or router dependency.
- **The types and the hook travel together.** `DraftSpec` is what `useDraft` takes and `Draft` is what it returns; splitting them across packages would leave one half of a contract in a package that does not know the feature. Server code and tests that need only the types use `import type` from `@sleekstack/model`, which loads nothing at run time.
- **Slot hooks outside `ui` use `@sleekstack/ui/internal`.** `useDraft` takes a slot in the running component's frame and reads the `Store`. `ui/internal` exports the pieces `ui`'s own hooks use: `Store`, `Frame`, `takeSlot`, `missingStore` and `writeOwn`. It is unstable like the rest of that entry, the same route `@sleekstack/query/ui` takes for `Collector` and `RenderScope`. A hook built on it fails outside a component run with the same errors as `ui`'s own hooks (`MissingDependency` without a Store, `SlotMismatch` on a changed slot count). `ui` does not depend on `model`.
- **The Analyzer recognizes `useDraft` by its declaration in `@sleekstack/model`**, so `ConditionalSlot` and a missing store are reported as before. A same-named hook from elsewhere is not a slot hook. The test that keeps the Analyzer's slot-hook list equal to the runtime hooks scans `model` as well as `ui`.

## Consequences

- An app opts in by installing `@sleekstack/model`. Imports of the four names from `core` or `ui` are compile errors.
- The ADR 0022 size budget measures a `mount` app with one Draft as its own entry. `ui`'s measured entries are smaller than before the move (the `mount` hello-world by 65 B gzip), and a `mount`-only bundle holds no Draft code.
- `ui/internal` gained a documented surface that an outside package builds on. Changing it may break `model` and `query`, which live in this repo and move with it.

## Rejected

- **Only the types move, `useDraft` stays in `ui`:** `ui` would still carry an optional feature and name the types it takes from another package.
- **`useDraft` rebuilt on `ui`'s public hooks (`useLocal`, `useDerivedAtom`):** it risks the pristine re-seed and the render-time write of a run's own input that ADR 0038 pins.
- **Compatibility re-exports from `core` and `ui`:** two import paths for one name (ADR 0019).
