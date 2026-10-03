---
satisfies: [R4, R5]
---
# fn-15-effect-native-component-framework-mvp.4 Analyzer component pass: tree per mount and four checks

## Description
Add the component pass to `@sleekstack/analyze`: build one tree per `mount` call (nodes `component`, `provide`, `catch`, `unresolved`) and report `MissingDependency`, `UnhandledError`, `EffectInsideReact` and `Unresolved` with file:line (R5), including an Effect component under a guest (R4). Kept in its own file so the graph extractor and fn-12's analyzer work barely overlap.

**Size:** M
**Files:** `packages/analyze/src/components.ts`, `packages/analyze/src/extract.ts` (library matcher + shared helpers only), `packages/analyze/src/model.ts` (tree types), `packages/analyze/src/index.ts` (export), `packages/analyze/src/__tests__/components.test.ts`, `packages/analyze/src/__tests__/fixtures/ui-*/`
**Touches:** [packages/analyze/src/**]

## Approach
- Export `analyzeComponents({ project }): { trees, errors }` from `index.ts`; leave `analyze()` and `Report` unchanged so non-ui projects see nothing new (R8).
- Extend `libId()` at `extract.ts:19` to `ui` and to `.tsx` sources; identify `mount`/`Provide`/`Catch`/`fromReact` by library symbol, like `TAG_CALLS` at `extract.ts:~36`. Reuse the program/checker setup, `loc()`, `fail()`/`Unreadable` pattern (`extract.ts:140-147`); hoist shared helpers out of the `extract` closure only as needed, no behavior change (pin: existing `fixtures.test.ts` stays green unmodified).
- Read a component's `E` and `R` from its return type `Effect<Node, E, R>` via the checker; read `Provide` layer outputs with the existing Layer reader (`extract.ts:~365-450`). Tag unions via `isUnion()`; literal `_tag` via the property type.
- Walk each tree once carrying provided Tags and caught tags downward (mount layer at the root). Every branch of ternary, `&&` and `.map` counts as rendered. Anything under a `fromReact` guest that is an Effect component, in children or props, is `EffectInsideReact`.
- Fail closed: `any`/`unknown`/error types, dynamic callees, widened arrays and unreadable declarations become `Unresolved` with location, never a pass.
- Fixtures follow `src/__tests__/fixtures/<name>/` with `// @error Code` markers: one per code plus one clean fixture; map `@sleekstack/ui` in each fixture tsconfig. Keep fixtures excluded from the package tsc run.

## Investigation targets
**Required**:
- `packages/analyze/src/extract.ts:19-160` — libId, call sets, fail/loc/report
- `packages/analyze/src/extract.ts:319-450` — list and Layer readers, `isImprecise`
- `packages/analyze/src/model.ts:14-25` — `Location`/`AnalyzeError`
- `packages/analyze/src/__tests__/fixtures.test.ts:1-20` — `expected`/`located` helpers

## Key context
- Memory: list-built nodes must be keyed by evaluation instance, not collapsed by declaration.
- Memory: tests must call the analyzer directly, never read a built `.sleekstack` report.


## Acceptance
- [ ] One tree per `mount` call; fixtures report each of the four codes at the marked file:line (R5).
- [ ] An Effect component under a `fromReact` guest reports `EffectInsideReact` (R4).
- [ ] The clean fixture reports nothing (R5).
- [ ] `any`, a dynamic component and an unreadable declaration each report `Unresolved` (R5).
- [ ] Existing analyze tests pass unmodified.
- [ ] `pnpm --filter @sleekstack/analyze test` and `typecheck` pass.

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
