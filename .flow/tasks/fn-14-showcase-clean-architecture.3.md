---
satisfies: [R2, R4, R5, R9]
---
# fn-14-showcase-clean-architecture.3 Board use cases + act() action adapter

## Description
Migration step 3. Add application/board.ts (createTask, moveTask, addComment) and board-view.ts (loadBoard) per spec API Contracts: parse domain/inputs schemas, generate ids/timestamps from IdGen/Clock in the per-call context (not in BoardStore, so demo overrides apply), run in BoardStore.transaction, write ActivityLog entry only after commit, return UI-ready projection. Add generic act(useCase) in delivery mapping DomainError -> {ok:false,error}, defects reject. Rewrite the three Server Actions in src/server/board.actions.ts as one-line act() calls; remove ExpectedFailure. Unit-test Board without Next against memory BoardStore, fixed Clock, deterministic IdGen. Demo overrides via runEffect must still work.

## Acceptance
- [ ] Board has exactly 4 ops; tests cover TaskNotFound, InvalidInput, SimulatedFailure with store untouched (R2)
- [ ] Rolled-back op leaves no audit entry; regression test (R4)
- [ ] Actions are one-line act(useCase), ActionResult shape unchanged, defect rejects; ExpectedFailure gone (R5)
- [ ] Demo-mode override test passes, and a new test asserts a task created in demo mode carries the overridden Clock timestamp (R9); existing tests green (R10)

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
