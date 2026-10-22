---
satisfies: [R3, R4]
---
# fn-68-file-routed-controllers.4 analyze: Controller recognition, diagnostics and check roots

Touches: [packages/analyze/src/controllers.ts, packages/analyze/src/errorCodes.ts, packages/analyze/src/index.ts, packages/analyze/src/__tests__/**, packages/cli/src/check.ts, packages/cli/src/__tests__/**, packages/cli/llms.md, apps/docs/content/docs/errors.mdx, packages/analyze/README.md]

## Description
Recognise Controllers in the analyzer: their methods through the shared reader, their route paths, and the diagnostics of R3 and R4. It also makes discovered Controllers roots for `sleekstack check`.

**Size:** M
**Files:** `packages/analyze/src/controllers.ts` (new), `packages/analyze/src/errorCodes.ts`, `packages/analyze/src/index.ts`, `packages/cli/src/check.ts`, `packages/cli/llms.md`, `apps/docs/content/docs/errors.mdx`, `packages/analyze/README.md`, tests and fixtures in analyze and cli

### Approach
- Recognise `*.controller.ts` files and their method exports: names matched case-sensitively, a near-miss (`get`, `Post`, `export default`) is `ControllerMethodShape`; one input object with keys limited to `params`, `query`, `body` (or none); `body` only on POST, PUT, PATCH, DELETE; referenced `params`/`query` Schemas must encode to strings. Reuse the task 3 reader.
- Own the Controller route-path derivation here (ADR 0050 syntax, `.controller.ts` suffix stripped, `index` and `(group)` kept in the route name) so the plugin and check share one source; check that `params` keys equal the path's params (`ControllerParamsMismatch`, including a missing `params` on a parameterised path).
- Add the two codes to the closed `AnalyzeCode` union and its table (`errorCodes.ts:11-32,48-170`), reword `ServerServiceTypeNotSerializable` to cover Controller types, update `errors.mdx:72-80`, and regenerate `cli/llms.md` (`UPDATE_LLMS=1`). `llms.md` is 7433 of 8192 bytes: shorten the generated rows to one line each rather than raising the cap.
- `check`: treat discovered Controllers as roots so a server-only app does not exit 2 (`check.ts:104-110`); a requirement a directory `wrap` discharges (its `next` requirements minus its result's) counts as provided for the Controllers beneath it (R3).

### Investigation targets
**Required** (read before coding):
- `packages/analyze/src/serverServices.ts:159-258` - checkFile, checkStart
- `packages/analyze/src/errorCodes.ts:11-179`
- `packages/cli/src/check.ts:100-140`
- `packages/analyze/src/extract.ts:707-766` - layerLeaf, for reading `wrap` and Layer types

**Optional**:
- `packages/analyze/src/__tests__/errorCodes.test.ts`, `packages/cli/src/__tests__/llms.test.ts`

## Acceptance
- [ ] fixtures cover each diagnostic: method near-miss, bad input key, `body` on GET, missing or extra `params` key, non-string `params` Schema, and a clean Controller
- [ ] `sleekstack check` on a server-only app with Controllers does not exit 2 and reports a missing dependency for an unprovided service
- [ ] a service provided by a directory `wrap` is not reported missing for Controllers beneath it
- [ ] `llms.md` regenerates under the 8192-byte cap and `errorCodes.test.ts` passes
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
