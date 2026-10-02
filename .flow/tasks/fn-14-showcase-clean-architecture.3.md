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
Added application/board.ts (Board: loadBoard, createTask, moveTask, addComment) and board-view.ts, plus server/act.server.ts mapping DomainError to ActionResult (defects reject). Actions are now `export const x = act(Board.x)`; ids/timestamps come from per-call IdGen/Clock. Tests: application/board.test.ts (R2/R4 error cases, store and audit untouched), act defect test and demo-mode Clock timestamp test in requests.test.ts.

baseline: green via handoff (verified at ff814b5 by task .2)
stage: impl-review - ran (codex fan-out NEEDS_WORK -> fixes -> SHIP)
Tier: opus at medium
## Evidence
- Commits: 639aed281d59be0aebc2d146a9b2e1a5ba3dbfc7, c3e6df8da1a1ab8db4ee33b8d5f32fa51b128af5
- Tests: pnpm -F showcase typecheck, pnpm -F showcase test (45/45)
- PRs: