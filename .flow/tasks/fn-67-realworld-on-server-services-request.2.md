---
satisfies: [R2]
---
# fn-67-realworld-on-server-services-request.2 analyze and ui-vite: `Schema.TaggedError` errors and string-keyed records in the type subset

## Description
The two shapes realworld's contracts use that the subset rejects today: errors built with `Schema.TaggedError` (the class is its own Schema) and string-keyed records (`errors: Record<string, ReadonlyArray<string>>` on `ValidationError`). Both extend the existing subset without a new `AnalyzeCode`.

**Size:** M
**Files:** packages/analyze/src/typeSchema.ts, packages/analyze/src/serverServices.ts, packages/analyze/src/index.ts, packages/analyze/src/__tests__/typeSchema.test.ts, packages/analyze/src/__tests__/fixtures/server-service-types/, packages/analyze/src/__tests__/fixtures/server-service-not-serializable/, packages/ui-vite/src/server-services.ts, packages/ui-vite/src/__tests__/server-services.test.ts
**Touches:** [packages/analyze/src/**, packages/ui-vite/src/**]

### Approach
- `TypeSchema` gains a `record` kind (value type); the printer emits `Schema.Record({ key: Schema.String, value: ... })`. Only a string key qualifies; a number, symbol or template-literal key, and several index signatures, stay `ServerServiceTypeNotSerializable` (extend the existing index-signature message).
- `taggedErrorBase` in the analyzer recognizes `Data.TaggedError` today; teach it `Schema.TaggedError` (from `effect/Schema`, add the `libId` pattern for it). The error description records that the class carries its own Schema, so the printer names the class directly instead of wrapping it in `taggedError(Class, fields)`.
- Add the new kinds to the round-trip test from the review fixes (print, evaluate, encode, JSON, decode) so both go through the wire form, and add a fixture for each unsupported variant.

### Investigation targets
**Required** (read before coding):
- `packages/analyze/src/typeSchema.ts:30-60` — the description types; `:135-150` index signature handling and tagged error recognition
- `packages/analyze/src/extract.ts:33-47` — `libId` (add the `effect/Schema` file)
- `packages/ui-vite/src/server-services.ts:36-80` — `printSchema` and `fields`
- `packages/ui-vite/src/__tests__/server-services.test.ts` — the printer table and round-trip describe block
- `apps/realworld/src/errors.ts` — the real `Schema.TaggedError` classes with a record field

**Optional** (reference as needed):
- `packages/start/src/service.ts` — `taggedError`, the wrapper the `Data.TaggedError` path uses

## Acceptance
- [ ] A fixture contract whose methods fail with a `Schema.TaggedError` subclass (with and without fields) reads without errors and prints the class itself as the error Schema.
- [ ] A `Record<string, ReadonlyArray<string>>` field round-trips through print, evaluate, encode, JSON and decode.
- [ ] Unsupported variants (number-keyed index signature, template-literal key, two index signatures, a record value outside the subset) report `ServerServiceTypeNotSerializable` with file:line and the member path.
- [ ] Existing description and printer tests are unchanged except for the added cases.
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/ui-vite` passes.

## Done summary
The type subset accepts `Schema.TaggedError` errors, described with `schema: true` and printed as the class itself, and string-keyed records, a new `record` kind printed as `Schema.Record`. The analyzer tests (`typeSchema.test.ts`, with the `schemaErrors`, `records`, `numberKey`, `templateKey`, `twoIndexes` and `recordValue` cases) and the ui-vite round-trip tests (a record, and a `Schema.TaggedError` decoding back into its class) cover both shapes. A number key, a template-literal key, several index signatures, properties beside an index signature, and a record value outside the subset each report `ServerServiceTypeNotSerializable`.

Follow-up: the `ServerServiceFileShape` and `ServerServiceTypeNotSerializable` rule text in `packages/analyze/src/errorCodes.ts`, and the `packages/cli/llms.md` generated from it, still name only `Data.TaggedError` and leave out records. I did not change them because `llms.md` is outside this task's Touches. Fit it into task .5 (docs).
Baseline: none run pre-edit; the commit before this task is task .1's receipt, which passed the same gates.

stage: impl-review - skipped(config: REVIEW_MODE=none)
Tier: session (jev-unavailable(no_key)); project routing block pins implementer opus at medium
## Evidence
- Commits: 274f6bb48a8280277a87f5fcf0546de64d0aa1cd
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/ui-vite, pnpm exec prettier --check <touched files>
- PRs: