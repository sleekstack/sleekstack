---
satisfies: [R1, R6]
---
# fn-14-showcase-clean-architecture.1 Domain: entities, errors, zod input schemas

## Description
Migration step 1. Under apps/showcase/src/domain/ add entities.ts, inputs.ts (one zod schema each for CreateTask, MoveTask, AddComment), errors.ts (Data.TaggedError: TaskNotFound, InvalidInput, SimulatedFailure; DomainError union). Extract from src/models/task.ts, src/models/task.server.ts, src/server/board.actions.ts. Point client Drafts (src/client/useDraftForm.ts, models/task.ts DraftSpec) at domain/inputs.ts so the duplicated 'cannot be empty' rule is gone. Keep domain client-safe; seed data/ids untouched. Old files may re-export temporarily to stay green.

## Acceptance
- [ ] domain/ imports nothing server-only; bundle.test.ts passes (R1)
- [ ] One schema per input in domain/inputs.ts, used by client Drafts; no duplicated empty-rule (R6)
- [ ] pnpm -F showcase test + typecheck green (R10)

## Done summary
Added apps/showcase/src/domain/{entities,errors,inputs}.ts; client Drafts and Server Actions now share one zod schema per input. The server keeps its old error wording by mapping the field name, so no test assertions changed. A domain DomainError union replaces ExpectedFailure inside board.actions; act() comes in task 3.

stage: impl-review - ran (codex: fan-out NEEDS_WORK on changed request assertion, fixed, re-review SHIP)
Tier: opus at medium
## Evidence
- Commits: ff12255ff5768dbba2f5812895878314561a532e, be5ba9b54587a2d906db722eb963bae0b5ecb59c
- Tests: pnpm -F showcase test, pnpm -F showcase typecheck, pnpm -F showcase build && vitest bundle.test.ts
- PRs: