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
Added `analyzeServerServices({ project })` (packages/analyze/src/serverServices.ts, exported from `@sleekstack/analyze`). It finds every `class X extends ServerService('Id')<X, Shape>() {}`, resolving the callee through the checker to `start/service#ServerService`, so imports from `@sleekstack/start`, `@sleekstack/start/client` or a local barrel all count. It returns `{ services, errors, checker }`. Each service carries its Tag id, class name, location and methods, and each method carries its raw `input`, `success` and `error` ts.Types for task 4. Two new codes have ERROR_CODES rows and an errors.mdx "Server Service errors" section: `ServerServiceFileShape` (a value in a contract file, a contract in a `*.server.ts`, a contract importing a `*.server.ts`, or a Tag id declared by two classes, reported once and naming both files) and `ServerServiceMethodShape` (more than one parameter, no explicit function type, a non-Effect return, R not `never`, or `any`). A non-literal Tag id, an anonymous class or a class declared below the top level is `Unresolvable`. `sleekstackAnalyzer` in ui-vite now reports this pass too.

Notes for later tasks: `libId` now also maps `packages/start` and `effect/Data`. `sleekstack check --json` output on showcase and realworld is identical with and without that change. packages/cli/llms.md is outside the declared Touches; it was regenerated with `UPDATE_LLMS=1` because cli's llms.test generates it from ERROR_CODES. The CLI `check` command does not run the new pass yet, since packages/cli was not in Touches. Tests: packages/analyze/src/__tests__/serverServices.test.ts covers the valid contract, the barrel and all 8 error fixtures, plus the duplicate-id message.

Tier: session (jev-unavailable(no_key)); project routing block pins implementer opus at medium (actual_model: claude-opus-5-5)

stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: 6f1951123443cef70e56ce4b0c2bfdc80da307b5
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/ui-vite
- PRs: