---
satisfies: [R2, R3]
---
# fn-6-docs-site-with-generated-api-reference.2 TSDoc on all public exports + summary/example checks

## Description
Write TSDoc for every public export of core, next, react, kit, kit/next and kit/react: a summary, `@param`, `@returns`, one `@throws` per error type (naming the error code), and at least one `@example` on functions. Comments only; no API changes. Turn on the empty-summary assertion in the coverage test. Add a check that extracts kit's `@example` blocks into temp `.ts` files and typechecks them (part of `apps/docs` typecheck or test).

Touches: packages/{core,next,react,kit}/src/**, apps/docs/test/api-coverage.test.ts, apps/docs/test/examples.test.ts

## Acceptance
- [ ] Coverage test fails on any export with an empty summary; it passes on the repo.
- [ ] kit `@example` blocks compile; a broken example fails the check.
- [ ] `pnpm typecheck && pnpm test` green across the repo; kit dts test still passes.


## Done summary
TSDoc (summary, @param, @returns, @throws with codes, @example) on every public export of core, next, react, kit, kit/next, kit/react; empty-summary assertion enabled in api-coverage.test.ts; new test/examples.test.ts extracts kit @example blocks and typechecks them (with a broken-example negative control). Comments only, no API changes.

Tier: opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK: 4 inaccurate @throws contracts -> fixed -> SHIP)
## Evidence
- Commits: 3d14f9a06e4023cec24d496644c8476a71e1bafb, 615dc38b54b091d97ee45d075ba1000ae5c23bd4
- Tests: pnpm typecheck && pnpm test, pnpm --filter docs build
- PRs: