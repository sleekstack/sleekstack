---
satisfies: [R3]
---
# fn-14-showcase-clean-architecture.2 BoardStore: replace Store/repos/UnitOfWork

## Description
Migration step 2. Add BoardStore Tag (domain/tags.ts interface) and in-memory Layer (infrastructure/board-store.memory.ts, may live in current folder until task 4). Interface: reads projects(), tasksOf(id), task(id), commentsOf(id) as Effects with TaskNotFound; transaction(f) where f gets a BoardTx with writes createTask(record), moveTask(id,status), addComment(record) (reads also work on tx and see its own writes); transactions are serialized by a one-permit lock and all-or-nothing, rolling back only their own writes; the store never generates ids/timestamps and does not depend on Clock/IdGen; no raw Map leaks, nothing throws. Port callers of Store, ProjectRepo, TaskRepo, CommentRepo, UnitOfWork (src/domain/live.server.ts, src/domain/tags.ts) and delete them. Drop Logger Tag only after grep shows no use. Add tests for rollback leaving state unchanged and for a failing transaction overlapping a successful one without erasing its write.

## Acceptance
- [ ] Failing mutation inside transaction leaves projects/tasks/comments unchanged, and a failing transaction overlapping a successful one keeps the successful write, both tested (R3)
- [ ] Old repo/UnitOfWork Tags removed; Tags = BoardStore, ActivityLog, Clock, IdGen, RequestContext (+Logger only if still used)
- [ ] Existing tests green, behavioral assertions unchanged; e2e/smoke.spec.ts graph-node assertion changes TaskRepo -> BoardStore (R10)

## Done summary
BoardStore (domain/tags.ts interface, src/infrastructure/board-store.memory.ts) replaces Store, ProjectRepo, TaskRepo, CommentRepo and UnitOfWork; transactions run on a copy of the tables under a one-permit lock and publish a detached copy only on success. Actions now take ids/timestamps from IdGen/Clock and record the audit entry after commit; Logger tag dropped (no other use); smoke graph assertion TaskRepo -> BoardStore. Tests: rollback, failing-overlapping-successful transaction, escaped BoardTx (board-store.memory.test.ts); UnitOfWork finalizer test removed with UnitOfWork.

stage: impl-review - ran (codex fan-out NEEDS_WORK: escaped BoardTx aliased committed tables; fixed with detached copy + test; re-review SHIP)
Tier: opus at medium
## Evidence
- Commits: 08562f9f13f3e8c4fbd0e42c488bb5c9ac095357, 269e4cf465be8f13a8e509c2eb4b8dd1a548aa64
- Tests: pnpm -F showcase typecheck, pnpm -F showcase test (36/36)
- PRs: