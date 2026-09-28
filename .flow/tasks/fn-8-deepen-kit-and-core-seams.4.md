---
satisfies: [R4]
---
# fn-8-deepen-kit-and-core-seams.4 Typed SleekStackError details per code

## Description
Make `SleekStackError` discriminated by `code` with per-code `details` types (mirror core tagged error fields; codes with no details get `{}`). Runtime unchanged. Type tests in `packages/kit/src/__tests__/errors.test-d.ts`. Update docs snippets if they rely on untyped details.

Touches: packages/kit/src/errors.ts, packages/kit/src/__tests__/errors.test-d.ts, packages/kit/src/__tests__/dts.test.ts, apps/docs/snippets/errors/**

## Acceptance
- [ ] Narrowing on `code` narrows `details` for every code (type tests).
- [ ] The kit dts test passes; docs typecheck passes.


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
