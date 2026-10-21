---
satisfies: [R5, R7]
---
# fn-66-server-services-di-style-server.3 analyze: read ServerService declarations, shape rules, duplicate Tag ids

## Description
The analyzer learns to find ServerService contracts through the checker and to enforce their shape. This task produces the declarations (Tag id, export name, location, raw method types) that task 4 converts to Schemas, and the first two new `AnalyzeCode` values.

**Size:** M
**Files:** packages/analyze/src/serverServices.ts (new), packages/analyze/src/errorCodes.ts, packages/analyze/src/index.ts, packages/analyze/src/__tests__/serverServices.test.ts (new), packages/analyze/src/__tests__/fixtures/ (new tiny projects), packages/ui-vite/src/analyze.ts, apps/docs/content/docs/errors.mdx
**Touches:** [packages/analyze/src/**, packages/ui-vite/src/analyze.ts, apps/docs/content/docs/errors.mdx]

### Approach
- `analyzeServerServices({ project })` returns `{ services, errors }`, shaped like `analyzeComponents({ project })`; reuse whatever program-loading helper `components.ts` and `extract.ts` share instead of building another.
- Recognize a class whose base is a call of `ServerService` imported from `@sleekstack/start` or `@sleekstack/start/client`, resolving the import through the checker (as Tag identity is resolved in `extract.ts`) so re-exports and barrels work. Read the literal Tag id from the call; a non-literal id is `Unresolvable`/`Computed` as those codes already mean.
- `ServerServiceFileShape`: a file exporting a ServerService holds only imports, type declarations, `Data.TaggedError` classes and ServerService classes; it is not a `*.server.ts`; it does not import one.
- `ServerServiceMethodShape`: at most one parameter; return type is an explicit `Effect.Effect<A, E, never>`; no `any` anywhere in the signature.
- Two ServerService classes with one Tag id: one error naming both files.
- `ERROR_CODES` is `Record<AnalyzeCode, ErrorHelp>` (compile error without a row): add rule, fix, docs anchor for both, and entries in `errors.mdx`.
- Add `analyzeServerServices` to the report list in `packages/ui-vite/src/analyze.ts` (`sleekstackAnalyzer`) so the overlay and the build show them.

### Investigation targets
**Required** (read before coding):
- `packages/analyze/src/components.ts:41` — `analyzeComponents` entry shape and program setup
- `packages/analyze/src/extract.ts` — Tag identity resolution through the checker
- `packages/analyze/src/errorCodes.ts:9-60` — the closed union and table
- `packages/analyze/src/__tests__/fixtures.test.ts` — the tiny-tsconfig fixture pattern
- `packages/ui-vite/src/analyze.ts:17-25` — where reports are merged

**Optional** (reference as needed):
- `packages/analyze/src/__tests__/errorCodes.test.ts` — what it asserts about rows and docs anchors

## Acceptance
- [ ] Fixtures (one tiny project each) pass for a valid contract and fail with file:line for: a ServerService in a `*.server.ts`; a value export in a contract file; a contract file importing a `*.server.ts`; a method with two parameters; a method returning a non-Effect; a method with a non-`never` `R`; a method typed with `any`; two classes with one Tag id.
- [ ] A ServerService re-exported through a barrel is still found.
- [ ] `errorCodes.test.ts` passes with the new rows; `errors.mdx` has an entry per new code.
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/ui-vite` passes.

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
