---
satisfies: [R2, R3]
---
# fn-6-docs-site-with-generated-api-reference.2 TSDoc on all public exports + summary/example checks

## Description
Write TSDoc for every public export of core, next, react, kit, kit/next and kit/react: a summary, `@param`, `@returns`, one `@throws` per error type (naming the error code), and at least one `@example` on functions. Comments only; no API changes. Turn on the empty-summary assertion in the coverage test. Add a check that extracts kit's `@example` blocks into temp `.ts` files and typechecks them (part of `apps/docs` typecheck or test).

Touches: packages/{core,next,react,kit}/src/**, apps/docs/test/**

## Acceptance
- [ ] Coverage test fails on any export with an empty summary; it passes on the repo.
- [ ] kit `@example` blocks compile; a broken example fails the check.
- [ ] `pnpm typecheck && pnpm test` green across the repo; kit dts test still passes.


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
