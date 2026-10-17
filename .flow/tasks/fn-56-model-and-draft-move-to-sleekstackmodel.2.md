---
satisfies: [R1, R2]
---
# fn-56-model-and-draft-move-to-sleekstackmodel.2 model: new package with the Model/Draft types, useDraft and tests

## Description
Create `@sleekstack/model` and move the whole feature into it with history preserved: `ModelSpec` and `DraftSpec` from core, and `useDraft`, `Draft`, `field` and their helpers from ui, plus the draft runtime and type tests. Core and ui stop exporting them.

**Size:** M
**Files:** new packages/model/ (package.json, tsconfig*.json, src/index.ts, src/model.ts, src/draft.ts, src/__tests__/draft.test.ts, draft.test-d.ts, README.md); delete packages/core/src/model.ts and its core index export; remove Draft code and exports from packages/ui/src/reactive.ts and index.ts; packages/ui/src/__tests__/draft*.ts moved; pnpm-workspace, pnpm-lock.yaml
**Touches:** [packages/model/**, packages/core/src/**, packages/core/README.md, packages/ui/src/**, packages/ui/README.md, pnpm-lock.yaml]

### Approach
- `git mv` the sources and tests so history follows; package layout copies `packages/router` (type module, `sideEffects: false`, peer dependencies on effect, core and ui, no react).
- `useDraft` imports the slot-hook surface from `@sleekstack/ui/internal` (task 1) and `Atom` / `AtomStore` from core.
- No re-export from the old locations (ADR 0019); the kit exports-name test, if it lists these names, is updated rather than aliased.
- Equivalence pin: moved tests keep their assertions; only import paths change. Check `git diff pnpm-lock.yaml` for stray `apps/sleek-codes` entries before staging.

### Investigation targets
**Required**:
- `packages/core/src/model.ts`, `packages/core/src/index.ts`
- `packages/ui/src/reactive.ts` (Draft types, `same`, `useDraft`, `field`)
- `packages/ui/src/__tests__/draft.test.ts`, `draft.test-d.ts`
- `packages/router/package.json`, `packages/router/tsconfig*.json`
- `docs/adr/0038-model-and-draft.md`
**Optional**:
- `packages/kit/src/__tests__/exportNames.test.ts`

## Acceptance
- [ ] `@sleekstack/model` exports `ModelSpec`, `DraftSpec`, `Draft`, `useDraft`, `field`; core and ui export none (a type test or compile-error fixture shows the old imports fail)
- [ ] Moved runtime and type tests pass with identical assertions
- [ ] A bundle that imports only `@sleekstack/model` contains no `react` and no router code
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/model... --filter=@sleekstack/core... --filter=@sleekstack/ui...` is green

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
