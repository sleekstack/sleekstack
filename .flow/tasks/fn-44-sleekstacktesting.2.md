---
satisfies: [R1, R3, R4, R5, R8, R9, R10, R11, R13]
---
# fn-44-sleekstacktesting.2 render, flush and mock Layer

## Description
render, flush and mock Layer. Contract and rationale are in the parent spec (R-IDs above).

**Size:** M
**Files:** packages/testing/src/render.ts, flush.ts, mockLayer.ts, index.ts and their tests
**Touches:** [packages/testing/src/**]

### Approach
- Wrap `mount`/`hydrateMount` in `act`, track handles, restore the act flag, register one guarded `afterEach` (dom.test.ts and pending.test.ts hold the pattern to package; `tick` seeds `flush`).
- Mock Layer from partial implementations over `Layer.succeed`; a Proxy throws a defect naming the missing method.
- No sleeps: use act ticks (known CI flake cause: missing RTL cleanup, sleep timing).

## Acceptance
- [ ] One call renders with a Layer and returns container and dispose (R1)
- [ ] Flag restored, single guarded afterEach, manual dispose without a runner hook (R8, R9)
- [ ] flush settles re-runs and effects, bounded with a tagged error (R3, R10)
- [ ] Mock Layer defect names the missing method (R5, R11)
- [ ] render({ hydrate }) adopts server HTML (R13)
- [ ] Auto-dispose after each test (R4)


## Done summary
Added `render` (mount or hydrate inside act, act flag on until the last in-flight or live render ends, single guarded afterEach auto-dispose, dispose cleanup in finally), `flush` (act ticks until the DOM is quiet, `FlushTimeout` after bounded rounds) and `mockLayer` (Proxy over `Layer.succeed`; an unsupplied own method throws naming `Tag.method`), with 10 tests in packages/testing/src/__tests__/testing.test.ts. Vitest config now uses `globals: true` so the afterEach hook registers; react is a peer dep.

Follow-up: flush detects settling by DOM quiet ticks, so DOM-silent timer work (e.g. Effect.sleep in an effect) can outlive it (review finding dropped as out of AC scope).

Tier: implementer opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK -> fixed -> SHIP)
## Evidence
- Commits: ffd485f66384c6d632ab4dd5f6ad21b5a259f2a5, 70313705015940da008d0ead5ca2228b166d0741
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/testing..., prettier --check packages/testing
- PRs: