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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
