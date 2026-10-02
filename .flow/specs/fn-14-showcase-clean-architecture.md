## Goal & Context
<!-- scope: business -->

Restructure `apps/showcase` into a clean architecture of deep modules, so the app teaches SleekStack and good layering at once. R1–R11 of the current showcase README keep working: app, request and component scopes, nested providers, demo overrides, the analyzer pages, and client bundle isolation.

Today the repositories are shallow, the three actions repeat one sequence, business rules live in the delivery file and are duplicated in the client, and `models/` imports from `server/`. A rolled-back mutation also leaves its entries in the activity log.

## Architecture & Data Models
<!-- scope: technical -->

Dependencies point inward only: `client` -> `domain`; `delivery` -> `application` -> `domain`; `infrastructure` -> `domain`. Only `infrastructure/app.ts` (the composition root) knows every layer. One documented exception: `delivery/runtime.server.ts` is the composition boundary and is the only delivery file that may import `infrastructure/app.ts` (to call `configureRuntime` over `AppLive`); `application/` never imports `infrastructure/`.

```
src/
  domain/          pure and client-safe: entities.ts, inputs.ts (zod), errors.ts (Data.TaggedError), tags.ts (Tags + service interfaces only)
  application/     server-only use cases: board.ts, board-view.ts
  infrastructure/  Layers: board-store.memory.ts, runtime-infra.live.ts, request.live.ts, demo.live.ts, app.ts
  delivery/        actions.ts, runtime.server.ts, demo-mode.ts, report.server.ts
  client/          components/, services/ (component-scoped Layers, scope-log), drafts/
  lib/contracts.ts generic ModelSpec / DraftSpec, imports nothing from the app
app/               pages call application through delivery only
```

Deep modules:

- **Board** (application): `loadBoard`, `createTask`, `moveTask`, `addComment`. It owns validation (parsing the domain input schemas), id and timestamp generation (`IdGen` and `Clock` from the per-call context, so demo overrides apply), the transaction, the audit entry and the UI-ready projection. The audit entry is written only after a commit succeeds.
- **BoardStore** (infrastructure, behind a Tag): replaces `Store`, `ProjectRepo`, `TaskRepo`, `CommentRepo` and `UnitOfWork`. Interface: reads `projects()`, `tasksOf(id)`, `task(id)`, `commentsOf(id)` as Effects with `TaskNotFound` in the error channel, plus `transaction(f)` where `f` receives a `BoardTx` with the writes `createTask(record)`, `moveTask(id, status)` and `addComment(record)` (each an Effect with `TaskNotFound` where it applies; reads also work on `tx` and see its own writes). Writes exist only on `tx`. Transactions are serialized by a one-permit lock inside the store, and are all-or-nothing: a failing `f` rolls back only its own writes. The store never generates ids or timestamps and does not depend on `Clock` or `IdGen`. No raw `Map` leaves the module and nothing throws.
- **Action adapter** (delivery): one generic `act(useCase)` maps any expected `DomainError` to `{ ok: false, error }`; defects still reject to `error.tsx`. `ExpectedFailure` is removed.
- **Single validation source**: `domain/inputs.ts` schemas are reused by the client Drafts and re-parsed by `Board` on the server.

Tags after the change: `BoardStore`, `ActivityLog`, `Clock`, `IdGen`, `RequestContext`. The unused `Logger` Tag is dropped.

## API Contracts
<!-- scope: technical -->

```ts
loadBoard:  Effect<BoardView, never, BoardStore>
createTask: (i: CreateTask) => Effect<Task,    DomainError, BoardStore | ActivityLog | Clock | IdGen | RequestContext>
moveTask:   (i: MoveTask)   => Effect<Task,    DomainError, BoardStore | ActivityLog | RequestContext>
addComment: (i: AddComment) => Effect<Comment, DomainError, BoardStore | ActivityLog | Clock | IdGen | RequestContext>
type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }   // unchanged
```

The three Server Actions keep their names and the `ActionResult` shape, so client call sites change only their import path.

## Edge Cases & Constraints
<!-- scope: technical -->

- `BoardStore` is a hypothetical seam (one adapter). It stays a Tag because the Graph is what the showcase teaches; the README says so.
- `Logger` is removed only after a grep shows no other use.
- The client bundle must still import only `domain/*` (marker test unchanged).
- `module()` and `declareLayer()` stay unused: the showcase is plain Effect.
- Seed data and ids stay as they are, so e2e and snapshot expectations do not move.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `domain/` imports nothing server-only and no `effect` services beyond Tags; a bundle test proves client chunks contain no server marker. Errors: any server import in the client graph fails `bundle.test.ts`.
- **R2:** `Board` exposes exactly the four operations above and is tested without Next.js, against the in-memory `BoardStore`, a fixed `Clock` and a deterministic `IdGen`. Errors: unknown task -> `TaskNotFound`; empty title or comment -> `InvalidInput`; simulated failure -> `SimulatedFailure`, store untouched.
- **R3:** `BoardStore.transaction` is all-or-nothing and serialized: a failing mutation leaves projects, tasks and comments unchanged, and a failing transaction overlapping a successful one never erases the successful write (tested with overlapping transactions). Errors: no error surface beyond R2's failures.
- **R4:** An audit entry exists only for a committed operation; a rolled-back operation leaves no entry.
- **R5:** The three Server Actions are one-line applications of `act(useCase)` and return the current `ActionResult` shape; a defect rejects. Errors: any `DomainError` -> `{ ok: false, error: message }`.
- **R6:** One zod schema per input lives in `domain/inputs.ts` and is used by both the client Drafts and `Board`; no duplicated "cannot be empty" rule remains.
- **R7:** No file under `models/` or `client/` imports from `delivery/` or `infrastructure/` except the Server Action references; the old `models -> server` import is gone.
- **R8:** `AppLive` is composed only in `infrastructure/app.ts`; `sleekstack check` still reports the app root, and `/graph` and `/errors` render. Errors: analyzer failures fail the build as today.
- **R9:** Demo mode still shadows `ActivityLog` and `Clock` per call through `runEffect` overrides (existing test passes), and a test asserts that a task created in demo mode carries the overridden `Clock` timestamp, not the live one.
- **R10:** The existing showcase tests (20 concurrent actions, rollback, StrictMode, bundle) and the Playwright smoke pass with their behavioral assertions unchanged. Only import paths and the smoke test's graph-node assertion change (`TaskRepo` -> `BoardStore`, `e2e/smoke.spec.ts`).
- **R11:** The README mapping table and file layout match the new structure.

## Boundaries
<!-- scope: business -->

- No real persistence, auth or new features.
- No new SleekStack API and no change to other packages.
- No `module()` or `declareLayer()` in the showcase.
- Visual design and CSS are untouched.

## Decision Context
<!-- scope: both -->

Chosen with the codebase-design vocabulary: deep modules over many shallow repositories, seams only where something varies. `ActivityLog` and `Clock` have two adapters (live and demo), so those seams are real. `BoardStore` has one adapter and is kept as a Tag only for the Graph demonstration.

Migration order, each step staying green: (1) `domain/` entities, errors and input schemas; (2) `BoardStore` and port the repositories; (3) `Board` and port the actions; (4) move files to the new folders; (5) README.

Maintainability (plan review): duplication - none identified; structure - `delivery/runtime.server.ts -> infrastructure/app.ts` was a back-edge against the dependency rule; now a documented composition-boundary exception.
