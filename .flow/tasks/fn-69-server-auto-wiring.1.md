---
satisfies: [R1, R2]
---
# fn-69-server-auto-wiring.1 analyze: Layer File pass, Server Root and zero-argument start in check

Touches: [packages/analyze/src/layerFiles.ts, packages/analyze/src/serverServices.ts, packages/analyze/src/errorCodes.ts, packages/analyze/src/index.ts, packages/analyze/src/__tests__/**, packages/cli/src/check.ts, packages/cli/src/__tests__/**, packages/cli/llms.md, apps/docs/content/docs/errors.mdx, packages/analyze/src/controllers.ts, packages/analyze/src/extract.ts]

## Description
Recognise `*.layer.ts` and the Server Root and compose the Layer Files by requirement (R1, R2). Needs no RPC reader, so it runs first. Depends on the sibling spec's discovered-app contract and server-only list.

**Size:** M
**Files:** `packages/analyze/src/layerFiles.ts` (new), `packages/analyze/src/serverServices.ts`, `packages/analyze/src/errorCodes.ts`, `packages/analyze/src/index.ts`, `packages/cli/src/check.ts`, `packages/cli/llms.md`, `apps/docs/content/docs/errors.mdx`, tests and fixtures in analyze and cli

### Approach
- Read each `*.layer.ts` default export's `Layer<ROut, E, RIn>` through the program; exclude tests with the shared test predicate. Compose by requirement: a requirement is provided by another Layer File's output; the explicit `layer` option wins for any Tag it provides and may require what Layer Files provide. Order independent files by path codepoint. <!-- Updated by plan-sync: fn-68-file-routed-controllers.4 reads Layers without `layerLeaf`/`plainLayer`: they are closures inside `extract()` (`extract.ts:709`, `:746`) and not exported, so reusing them means exporting them from `extract.ts`, outside Touches. The Controller pass and `checkStart` read a Layer expression's type with `layerOutputs(expr, checker)` (exported from `serverServices.ts:196-202`: the `ROut` members, undefined for a non-Layer or `any`); `RIn` is the third type argument of the same type, read beside it (in Touches). The files are `sourcesOf(program, root)` (`serverServices.ts:161-170`: root files of the tsconfig, with declaration files, `node_modules` and `TEST_FILE` left out), as `analyzeControllers` takes them; `TEST_FILE` is `extract.ts:64`, exported from the package -->
- Reuse `validate.ts` for unmet requirements (`MissingDependency`); add `LayerFileCycle`, `LayerFileConflict` (two files whose output provides the same Tag, naming both) and the shape code `ServerFileShape` (no Layer default export, a default export typed `any`, an unknown export in `_app.ts`) to the closed `AnalyzeCode` union and table (`errorCodes.ts:11-34,54-179`). <!-- Updated by plan-sync: fn-68-file-routed-controllers.4 added `ControllerMethodShape` and `ControllerParamsMismatch`, so the union is `errorCodes.ts:11-34` and the table `:54-179`, with a `CONTROLLER` docs anchor (`/docs/errors#controller-errors`) beside `SERVER`. `errors.mdx` has a Server Service errors and a Controller errors section, so the new codes need a section and an anchor of their own -->
- `_app.ts` in the server directory takes only `onError`.
- `check`: a zero-argument `start()` is invisible to `checkStart` (`serverServices.ts:351-375`, which reads an object-literal argument and skips a call without one); make the discovered Layer Files a root so an app with no Controllers and no `configureRuntime` does not exit 2 (`check.ts:105-118`). <!-- Updated by plan-sync: fn-68-file-routed-controllers.4 already made discovered Controllers roots: the no-roots guard (`check.ts:105-118`) and `ok` (`:129-134`) count `analyzeControllers({ project })`. `check` calls it with the default `server` and `server/routes` (no flag; `serverDir` and `controllersDir` are Vite-only options), so the Layer File, Server Root and RPC passes read the default `server` too, and the docs (task 11) say so. Only the Layer Files are left to add -->
- Touches note: `packages/analyze/src/controllers.ts` is outside Touches yet must change. It decides what counts as provided for a Controller (`fromStart`, the `start({ layer })` outputs, `:174-179`; `isProvided`, `:382-383`; the `wrap` requirement check, `:385-401`) and knows no Layer File, so once Layer Files exist a Controller or `wrap` that requires a service they provide is a false `MissingDependency`. Realworld's `server/routes/api/_defaults.ts` `wrap` is `Effect<Response, never, Db | TokenSecret>`, and task 9 moves `Db` and `TokenSecret` into Layer Files, so `pnpm --filter realworld check` fails after it unless the composed Layer File outputs count as provided there. <!-- Added by plan-sync: fn-68-file-routed-controllers.4 and .10 -->
- Add the new codes' rows and regenerate `cli/llms.md` (`UPDATE_LLMS=1 vitest run llms`) keeping the rows one line each. <!-- Updated by plan-sync: fn-68-file-routed-controllers.4 shortened the generator (it writes only each code's `rule`; `sleekstack explain` prints the fixes), so `llms.md` is 5911 of 8192 bytes, not near its cap -->


### Investigation targets
**Required** (read before coding):
- `packages/analyze/src/extract.ts:700-770` - layerLeaf, plainLayer (closures inside `extract()`)
- `packages/analyze/src/validate.ts` - MissingDependency, DependencyCycle, Ambiguous
- `packages/analyze/src/serverServices.ts:161-202,351-375` - sourcesOf, startCalls, layerOutputs, checkStart
- `packages/analyze/src/controllers.ts:111-179,382-413` - the Controller pass and what it counts as provided
- `packages/cli/src/check.ts:100-135`

**Optional**:
- `packages/analyze/src/runtimeRoots.ts:22-35,122-137` - RootCtx precedent

## Acceptance
- [ ] fixtures: two files composed by requirement, a cycle, a duplicate provider, an unmet requirement, a file with no Layer default export, a default typed `any`, a `_app.ts` with a stray export, a test-only Layer under `test/` that is excluded
- [ ] composition order is deterministic (path codepoint) and an explicit `layer` shadows a Layer File's Tag
- [ ] `sleekstack check` on an app with only discovered Layer Files and Controllers does not exit 2 <!-- Updated by plan-sync: fn-68-file-routed-controllers.4 and .10: it also reports no `MissingDependency` for a Controller or a `wrap` whose requirement a Layer File provides, and still reports one for a service nothing provides -->

- [ ] `llms.md` regenerates under its cap; `errorCodes.test.ts` passes
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
