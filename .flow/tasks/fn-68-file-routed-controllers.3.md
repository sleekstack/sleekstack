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
- Pull `methodOf` (`serverServices.ts:99-132`) out into a reader parameterised by whether `R` must be `never` (hand-written Server Services keep it; Controllers and RPC allow any `R`) and by the accepted input shape. Keep the written-signature, `hasAny` and Effect type-argument logic as it is.
- Add a `ref` kind to `TypeSchema` (`typeSchema.ts:35-42`) for `Schema.Schema.Type<typeof X>`: read syntactically from the type node, inline or through a same-file alias, at any position of a written type (property, array element, union member); `X` must be an exported Schema value of a client-safe module, otherwise a diagnostic path (the code is added in task 4). Add a `codec: 'string'` flag for HTTP path and query values (finite-decimal `number`, `true`/`false` `boolean`); a referenced Schema is used as written.
- Teach `printSchema` (`server-services.ts:73-94`) to print a `ref` through the existing `alias()` import mechanism and the string codecs. <!-- Updated by plan-sync: fn-68-file-routed-controllers.1 added lines to server-services.ts, so the line references moved -->
- Equivalence pin: record the generated `virtual:sleek/server-registry` text for the realworld and showcase contracts and the analyzer's reader output for the existing fixtures before the change; they must match byte for byte after it.

### Investigation targets
**Required** (read before coding):
- `packages/analyze/src/serverServices.ts:96-156`
- `packages/analyze/src/typeSchema.ts:35-201`
- `packages/ui-vite/src/server-services.ts:73-145`
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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
