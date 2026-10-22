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
The analyzer now recognizes Controllers (R3, R4). `analyzeControllers` reads every `*.controller.ts` file: its route comes from `controllerRoute`, its methods go through the shared reader, and it reports `ControllerMethodShape`, `ControllerParamsMismatch` and `MissingDependency`. `sleekstack check` counts Controllers as roots, so a server-only app no longer exits 2.

- Route derivation: `controllerRoute(controllersDir, file)` in `packages/analyze/src/controllers.ts`, exported from `index.ts`, returns `{ route, pattern }` in ADR 0050 syntax. `index` and `(group)` stay in the route name. It returns undefined for a path under `_` and throws `sleekstack: invalid Controller file <file>: ...` for a file outside the directory, a segment of no route form, or an optional or splat segment that is not last. Task 7 can call it directly. `check` reports the same throw as `Unresolvable`, because the spec names no code for it.
- Reader options (`serverServices.ts`, `typeSchema.ts`): `readSignature` gained `returns: 'optional'` and `errors: 'any'`. With an unwritten return type, the inferred return must still be an Effect, and `schema.success` is undefined. `MethodSchema`/`MethodSignature` gained a defaulted `Success` type parameter, and overloads keep the Server Service path typed `TypeSchema`. `methodSchema` now takes the signature node. The Server Service output did not change: analyze's 108 earlier tests, ui-vite's 190 tests (which pin the generated text) and realworld's 155 tests all pass unchanged. `locationOf`, `sourcesOf`, `startCalls`, `propertyOf` and `layerOutputs` were moved out of `analyzeServerServices` so both passes use them.
- Method rules: method names match case-sensitively, and methods come out in canonical order. A default export, or an export that differs from a method name only in case, is `ControllerMethodShape`. Type-only exports and other names are ignored. The input must be one object with keys limited to `params`, `query` and `body`, and `body` is allowed only on POST, PUT, PATCH and DELETE. A whole input written as one Schema reference is refused. `number`/`boolean` values (including query array elements) are marked `codec: 'string'`. A referenced `params`/`query` Schema is checked through its `Encoded` type. A value that cannot decode from a string (an object, `null`, a numeric literal) is `ControllerMethodShape`. `params` keys must equal the path's params, and a method with no `params` on a parameterized path is a mismatch.
- R3: a method's `R` must be provided by a request service (`start/services#Request|Cookies|ResponseHeaders|ResponseStatus`), by the `ROut` of a `start({ layer })`, or by a `wrap` above it. The `wrap` chain is each `_defaults.ts` from `serverDir` down, then the Controller's own. A wrap discharges its `next` requirements minus those of its result.
- Codes and docs: the two new codes are in `errorCodes.ts` with the anchor `/docs/errors#controller-errors`. `ServerServiceTypeNotSerializable` now covers Controllers, and the `ServerServiceMethodShape` rule and its `errors.mdx` row now cover an unusable Schema reference. `errors.mdx` gained a Controller errors section, and its `ServerFileInClientGraph` row now lists all server-only kinds. The `llms.md` generator now writes only the rule for each code (`sleekstack explain` prints the fixes), which brings the file to 5911 of 8192 bytes. The analyze README gained a Controller pass section.

Tests: `controllers.test.ts` has 22 tests. They cover the route table and its throws, every diagnostic at its file:line from `// @error` markers in `fixtures/controllers` (near-miss, bad input key, body on GET, extra and missing `params` keys, non-string `params` Schema, whole-input reference, Date body, orphan, non-last splat), the clean Controller's marked Schemas, and the wrap scoping. `Viewer` is provided under `users/` but reported for `missing`. The CLI test `check.test.ts` "a server-only app..." uses the fixture `controllers`. Each red was checked: turning off each of the three provider sources fails the test, and so does removing the Controller-roots clause from `check.ts`, which makes check exit 2.

Gates: baseline green via receipt ab532ecd (only `.flow/` changed since). After the change the full Quick command passed: 28 tasks, 9 uncached (analyze 130, cli 28, ui-vite 190, realworld 155 tests); receipt `.flow/tmp/green-receipts/07faa8d8-unittest.json`. `pnpm --filter realworld check` exit 0. The fixture graph check output is byte-identical before and after (10803 bytes).

Follow-ups, not built:
- Task 5 must declare `ResponseStatus` in `packages/start/src/services.ts`. The analyzer recognizes request services by `start/services#<name>`.
- A `wrap`'s own result requirements are not checked against providers. A generic `wrap` signature discharges nothing.
- A method with no return annotation whose body returns a union of Effects (`cond ? Effect.fail(x) : Effect.void`) is refused as "does not return an Effect". The fix is to annotate it or return a single Effect.
- The "No roots" message of `check` still names only `configureRuntime`/`mount`.

Tier: session (jev-unavailable(no_key)); routing block sets opus at medium (actual: claude-opus-5-5)

stage: impl-review - skipped(policy: user asked for one completion review at the end of the spec)
## Evidence
- Commits: 07faa8d82a4241ab612dafa93dff1e2fc64eb3cc
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=realworld, pnpm --filter realworld check, (cd packages/cli/src/__tests__/fixtures/effect-app && node ../../../../bin/cli.js check --json --entry runtime.ts) - identical before and after, baseline: green via receipt ab532ecd (only .flow/ changed since)
- PRs: