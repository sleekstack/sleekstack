---
satisfies: [R4]
---
# fn-68-file-routed-controllers.3 analyze: shared signature reader with a Schema reference kind

Touches: [packages/analyze/src/serverServices.ts, packages/analyze/src/typeSchema.ts, packages/analyze/src/index.ts, packages/analyze/src/__tests__/**, packages/ui-vite/src/server-services.ts, packages/ui-vite/src/__tests__/server-services.test.ts]

## Description
Extract the method-signature reader so Controller Methods and the sibling spec's RPC methods share it (R4), and teach the Type-to-Schema description a reference kind. Refactor-shaped for hand-written Server Services.

**Size:** M
**Files:** `packages/analyze/src/serverServices.ts`, `packages/analyze/src/typeSchema.ts`, `packages/analyze/src/index.ts`, `packages/ui-vite/src/server-services.ts`, their tests and fixtures

### Approach
- Pull `methodOf` (`serverServices.ts:122-155`) out into a reader parameterised by whether `R` must be `never` (hand-written Server Services keep it; Controllers and RPC allow any `R`) and by the accepted input shape. Keep the written-signature, `hasAny` and Effect type-argument logic as it is. <!-- Updated by plan-sync: fn-68-file-routed-controllers.2 added lines to serverServices.ts (the `SERVER_ONLY` list, `isServerOnly`, the `serverDir` option), so the line references moved -->
- Add a `ref` kind to `TypeSchema` (`typeSchema.ts:35-42`) for `Schema.Schema.Type<typeof X>`: read syntactically from the type node, inline or through a same-file alias, at any position of a written type (property, array element, union member); `X` must be an exported Schema value of a client-safe module, otherwise a diagnostic path (the code is added in task 4). Add a `codec: 'string'` flag for HTTP path and query values (finite-decimal `number`, `true`/`false` `boolean`); a referenced Schema is used as written.
- Teach `printSchema` (`server-services.ts:74-95`) to print a `ref` through the existing `alias()` import mechanism and the string codecs. <!-- Updated by plan-sync: fn-68-file-routed-controllers.1 added lines to server-services.ts, so the line references moved --> <!-- Updated by plan-sync: fn-68-file-routed-controllers.2 moved them again -->
- Equivalence pin: record the generated `virtual:sleek/server-registry` text for the realworld and showcase contracts and the analyzer's reader output for the existing fixtures before the change; they must match byte for byte after it.

### Investigation targets
**Required** (read before coding):
- `packages/analyze/src/serverServices.ts:119-179`
- `packages/analyze/src/typeSchema.ts:35-201`
- `packages/ui-vite/src/server-services.ts:74-146`
- `.flow/memory/bug/build-errors/syntactic-default-export-check-must-2026-10-20.md` - skip type-only forms

**Optional**:
- `packages/analyze/src/__tests__/fixtures/server-service-any/tsconfig.json` - fixture pattern

## Acceptance
- [ ] reader output and generated registry text are unchanged for every existing contract and fixture
- [ ] `Schema.Schema.Type<typeof X>` is read inline, through a same-file alias, and nested inside an object, array and union
- [ ] a type-only `X` or an `X` from a server-only module is rejected with a diagnostic path
- [ ] a test pins the `string` codec output for `number` and `boolean`
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/ui-vite...` passes

## Done summary
Extracted the shared method-signature reader and taught Type to Schema a Schema reference kind and HTTP string codecs (R4). Hand-written Server Services read exactly as before.

- Reader: `readSignature(ctx, sig, { requires, input? })` lives in `packages/analyze/src/serverServices.ts` and takes any written `ts.SignatureDeclaration`. `requires: 'never'` keeps the Server Service rule. `'any'` is the Controller and RPC mode. `input` is the accepted-input check: it refuses a parameter type before any Schema is built, at the parameter. A refusal is `Unreadable` (the method's shape; the caller picks the code) or `NotSerializable`. `methodOf` now only unwraps the shape member and maps refusals to the existing codes. The `any` check reads only the written types, never a body.
- Reference kind: `TypeSchema` gains `{ kind: 'ref', file, name }` for `Schema.Schema.Type<typeof X>`. It is read from the signature's text: inline, through a type alias of the same file, and as a property, an array element or a union member. Each use is followed where it is written. A reference in any other form (a generic alias or interface, a mapped type, a record, the `E`/`R` of the Effect) is `Unreadable`, so it never silently becomes its structural type. `X` must be an exported runtime value (an `export type` and a `declare` do not count), of a module that is not server-only, and assignable to `Schema.Schema.All`. A default export is referenced as `default`. In Server Service contracts the refusal is reported as `ServerServiceMethodShape`.
- Codec: `number` and `boolean` gain `codec?: 'string'`. `printSchema` (ui-vite) prints a finite-decimal transform (no NaN, Infinity, hex, exponent or overflow) and `Schema.BooleanFromString`. It prints a `ref` through the existing `alias()` import.
- Equivalence pin: the reader output for all 56 existing analyze fixtures and the generated `virtual:sleek/server` and `virtual:sleek/server-registry` text for realworld and showcase are byte-identical before and after (a scratch tsx script, re-run after the review fixes).

Tests (each was checked red by reverting the code it covers): analyze `typeSchema.test.ts` "Schema references" covers the inline, alias, nested object/array/union and default-export forms, plus `Schema.Unknown`/`Never`. Its refusal test pins the message and line for a type-only `X`, a server-only `X`, a declared-only `X`, a non-Schema value, a qualified name, a generic wrapper, a generic alias body, a generic interface, and a second alias use inside a wrapper. `serverServices.test.ts` "readSignature" covers `requires: 'any'` versus `'never'`, the input check, and a body `any`. ui-vite `server-services.test.ts`: `printSchema` pins `ref`, the number codec and the boolean codec. A decode test shows both codecs accept only their texts. A registry test imports a referenced Schema and decodes through it (`NonEmptyString` rejects `''`).

Follow-ups for task 4, not built here:
- The reader still requires a written return type and tagged errors in `E`. Controllers may omit the return annotation (R5), and their `E` never crosses the wire, so task 4 will need a reader option for both. That means a `serverServices.ts`/`typeSchema.ts` edit outside task 4's current Touches.
- Marking `params`/`query` with `codec: 'string'`, and checking that a referenced `params`/`query` Schema encodes to strings, are left to the Controller recognizer.
- A cross-file alias such as `export type User = Schema.Schema.Type<typeof User>` is printed structurally, as the spec's "any other written type" rule says.

Review: codex fan-out round 1 NEEDS_WORK with 3 findings. The first was per-use reference tracking: a shared alias node hid a lost reference, and generic alias bodies were not searched. The second was the Schema check rejecting `Unknown`/`Never`. The third was `hasAny` reading function bodies. All three were fixed in ab532ecd, and the round-2 re-review returned SHIP.

Gates: baseline green via receipt 1cdd61aa. After the change the spec's full test and typecheck command passed: 28 tasks, 9 uncached (analyze 108, ui-vite 190, cli 27, realworld 155 tests). Receipt `.flow/tmp/green-receipts/ab532ecd-unittest.json`. `pnpm --filter realworld check` is green, and the fixture graph check is identical before and after (no public export change).
GATE_SKIPPED:unittest:green-receipt 1cdd61aa - baseline reused from prior post-gate pass

Memory: bug/integration `syntactic-schema-reference-reading-must-2026-10-22`.

Tier: session (jev-unavailable(no_key)); routing block sets opus at medium (actual: claude-opus-5-5)

stage: impl-review - ran (round 1 codex fan-out NEEDS_WORK, 3 findings; round 2 codex re-review SHIP on 43d8d366..ab532ecd)
## Evidence
- Commits: dd93c7468e50eba758bb545441dc55df4ae19f23, ab532ecda118baa46ce8fee9e6a865492e881af9
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=realworld, pnpm --filter realworld check, (cd packages/cli/src/__tests__/fixtures/effect-app && node ../../../../bin/cli.js check --json --entry runtime.ts) # before/after identical, GATE_SKIPPED:unittest:green-receipt 1cdd61aa - baseline reused from prior post-gate pass
- PRs: