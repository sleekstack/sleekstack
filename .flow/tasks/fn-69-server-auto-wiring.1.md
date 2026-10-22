---
satisfies: [R1, R2]
---
# fn-69-server-auto-wiring.1 analyze: Layer File pass, Server Root and zero-argument start in check

Touches: [packages/analyze/src/layerFiles.ts, packages/analyze/src/serverServices.ts, packages/analyze/src/errorCodes.ts, packages/analyze/src/index.ts, packages/analyze/src/__tests__/**, packages/cli/src/check.ts, packages/cli/src/__tests__/**, packages/cli/llms.md, apps/docs/content/docs/errors.mdx]

## Description
Recognise `*.layer.ts` and the Server Root and compose the Layer Files by requirement (R1, R2). Needs no RPC reader, so it runs first. Depends on the sibling spec's discovered-app contract and server-only list.

**Size:** M
**Files:** `packages/analyze/src/layerFiles.ts` (new), `packages/analyze/src/serverServices.ts`, `packages/analyze/src/errorCodes.ts`, `packages/analyze/src/index.ts`, `packages/cli/src/check.ts`, `packages/cli/llms.md`, `apps/docs/content/docs/errors.mdx`, tests and fixtures in analyze and cli

### Approach
- Read each `*.layer.ts` default export's `Layer<ROut, E, RIn>` through the program, reusing `layerLeaf`/`plainLayer` (`extract.ts:707-766`); exclude tests with the shared test predicate. Compose by requirement: a requirement is provided by another Layer File's output; the explicit `layer` option wins for any Tag it provides and may require what Layer Files provide. Order independent files by path codepoint.
- Reuse `validate.ts` for unmet requirements (`MissingDependency`); add `LayerFileCycle`, `LayerFileConflict` (two files whose output provides the same Tag, naming both) and the shape code `ServerFileShape` (no Layer default export, a default export typed `any`, an unknown export in `_app.ts`) to the closed `AnalyzeCode` union and table (`errorCodes.ts:11-32,48-170`).
- `_app.ts` in the server directory takes only `onError`.
- `check`: a zero-argument `start()` is invisible to `checkStart` (`serverServices.ts:211-258`, which reads an object-literal argument); make the discovered Layer Files and Controllers the root so a server-only app does not exit 2 (`check.ts:104-110`).
- Add the new codes' rows and regenerate `cli/llms.md` keeping the rows one line each (it is near its 8192-byte cap; the first spec shortened it already).

### Investigation targets
**Required** (read before coding):
- `packages/analyze/src/extract.ts:700-770` - layerLeaf, plainLayer
- `packages/analyze/src/validate.ts` - MissingDependency, DependencyCycle, Ambiguous
- `packages/analyze/src/serverServices.ts:211-258`
- `packages/cli/src/check.ts:100-140`

**Optional**:
- `packages/analyze/src/runtimeRoots.ts:22-35,122-137` - RootCtx precedent

## Acceptance
- [ ] fixtures: two files composed by requirement, a cycle, a duplicate provider, an unmet requirement, a file with no Layer default export, a default typed `any`, a `_app.ts` with a stray export, a test-only Layer under `test/` that is excluded
- [ ] composition order is deterministic (path codepoint) and an explicit `layer` shadows a Layer File's Tag
- [ ] `sleekstack check` on an app with only discovered Layer Files and Controllers does not exit 2
- [ ] `llms.md` regenerates under its cap; `errorCodes.test.ts` passes
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
