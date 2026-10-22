---
satisfies: [R3, R4]
---
# fn-68-file-routed-controllers.4 analyze: Controller recognition, diagnostics and check roots

Touches: [packages/analyze/src/controllers.ts, packages/analyze/src/serverServices.ts, packages/analyze/src/typeSchema.ts, packages/analyze/src/errorCodes.ts, packages/analyze/src/index.ts, packages/analyze/src/__tests__/**, packages/cli/src/check.ts, packages/cli/src/__tests__/**, packages/cli/llms.md, apps/docs/content/docs/errors.mdx, packages/analyze/README.md]

## Description
Recognise Controllers in the analyzer: their methods through the shared reader, their route paths, and the diagnostics of R3 and R4. It also makes discovered Controllers roots for `sleekstack check`.

**Size:** M
**Files:** `packages/analyze/src/controllers.ts` (new), `packages/analyze/src/serverServices.ts`, `packages/analyze/src/typeSchema.ts`, `packages/analyze/src/errorCodes.ts`, `packages/analyze/src/index.ts`, `packages/cli/src/check.ts`, `packages/cli/llms.md`, `apps/docs/content/docs/errors.mdx`, `packages/analyze/README.md`, tests and fixtures in analyze and cli

### Approach
- Recognise `*.controller.ts` files and their method exports: names matched case-sensitively, a near-miss (`get`, `Post`, `export default`) is `ControllerMethodShape`; one input object with keys limited to `params`, `query`, `body` (or none); `body` only on POST, PUT, PATCH, DELETE; referenced `params`/`query` Schemas must encode to strings. Reuse the task 3 reader. <!-- Updated by plan-sync: fn-68-file-routed-controllers.3 built it as `readSignature(ctx, sig, { requires: 'any', input? })` in `serverServices.ts` (`ctx` is `{ program, checker, root, serverDir }`), not exported from `index.ts`; it returns the signature or an `Unreadable` (map to `ControllerMethodShape`) or `NotSerializable` (map to `ServerServiceTypeNotSerializable`) from `typeSchema.ts`. Its `input` check sees only the parameter's structural type, before any Schema is built, so the key and `body`-method rules fit there; the encodes-to-strings check of a referenced `params`/`query` Schema cannot (the structural type no longer names `X`), so run it on the `ref` entries (`file`, `name`) of the result's `schema.input` -->
- The reader still needs two options for Controllers: it requires a written return type (`!sig.type` is `Unreadable`), yet R5 lets a method omit the return annotation, and `methodSchema` requires every `E` member to be a tagged error class, yet a Controller's `E` never crosses the wire. Add an option for each in `serverServices.ts`/`typeSchema.ts`, with `requires: 'never'` and every Server Service output unchanged (the equivalence pin of task 3 still holds). <!-- Updated by plan-sync: fn-68-file-routed-controllers.3 left both for this task, so Touches gains `serverServices.ts` and `typeSchema.ts` -->
- A whole input written `Schema.Schema.Type<typeof X>` is read by the reader as one `ref`, with no `params`, `query` or `body` to key-check, mark with a codec or split into three Schemas. R4's references sit at the keys (`{ params: ..., body: Schema.Schema.Type<typeof X> }`), so refuse a whole-input `ref` as an unreadable form (`ControllerMethodShape`) unless this task finds a use for it. <!-- Updated by plan-sync: fn-68-file-routed-controllers.3 reads a whole-input reference as `{ kind: 'ref' }`, as its Server Service fixture `inline` shows -->
- Mark the `number` and `boolean` leaves of `params` and `query` (including array elements of `query`) with `codec: 'string'` after the read: the reader never sets it, and `printSchema` of task 3 already prints it. <!-- Updated by plan-sync: fn-68-file-routed-controllers.3 left the marking to the Controller recognizer -->
- Own the Controller route-path derivation here (ADR 0050 syntax, `.controller.ts` suffix stripped, `index` and `(group)` kept in the route name) so the plugin and check share one source; check that `params` keys equal the path's params (`ControllerParamsMismatch`, including a missing `params` on a parameterised path).
- Add the two codes to the closed `AnalyzeCode` union and its table (`errorCodes.ts:11-32,48-170`), reword `ServerServiceTypeNotSerializable` to cover Controller types, add to the `ServerServiceMethodShape` rule and `errors.mdx` row a Schema reference the reader cannot use (task 3 reports it there for Server Service contracts, which now read `Schema.Schema.Type<typeof X>` too), update `errors.mdx:72-80`, and regenerate `cli/llms.md` (`UPDATE_LLMS=1`). `llms.md` is 7515 of 8192 bytes: shorten the generated rows to one line each rather than raising the cap. <!-- Updated by plan-sync: fn-68-file-routed-controllers.2 reworded the `ServerFileInClientGraph` rule and regenerated llms.md (was 7433 bytes) -->
- `check`: treat discovered Controllers as roots so a server-only app does not exit 2 (`check.ts:104-110`); a requirement a directory `wrap` discharges (its `next` requirements minus its result's) counts as provided for the Controllers beneath it (R3).

### Investigation targets
**Required** (read before coding):
- `packages/analyze/src/serverServices.ts:70-114` - readSignature, the task 3 reader
- `packages/analyze/src/serverServices.ts:229-329` - checkFile, checkStart <!-- Updated by plan-sync: fn-68-file-routed-controllers.3 added `readSignature` above them, so the line references moved -->
- `packages/analyze/src/typeSchema.ts:97-356` - methodSchema, the Schema reference reader and the error reader
- `packages/analyze/src/errorCodes.ts:11-179`
- `packages/cli/src/check.ts:100-140`
- `packages/analyze/src/extract.ts:708-767` - layerLeaf, for reading `wrap` and Layer types

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
