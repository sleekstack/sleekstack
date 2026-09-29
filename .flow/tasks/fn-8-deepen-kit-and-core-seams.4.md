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
SleekStackError is now a union narrowed by `code`, with per-code `details` (the public type `SleekStackErrorDetails`). The constructor checks that the code and its details match. `normalize`'s fallback parameter is narrowed.

Review: round 2 was SHIP for correctness and contracts. The integration reviewer's one finding (the error class can no longer be subclassed, TS2508) was waived by the conductor: the spec doesn't promise subclassing, and allowing it would undo R4. The runtime class, its name and instanceof still work and are tested.
## Evidence
- Commits: c695ec3, f3ac6b0
- Tests: pnpm typecheck, pnpm test --force, pnpm --filter docs build && pnpm --filter docs test
- PRs: