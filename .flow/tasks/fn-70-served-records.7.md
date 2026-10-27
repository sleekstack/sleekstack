---
satisfies: [R9, R10]
---
# fn-70-served-records.7 showcase: serve the User record and keep Post hand-written beside it

Touches: [apps/showcase/src/pages/model.tsx, apps/showcase/src/modules/**, apps/showcase/server/**, apps/showcase/test/**, apps/showcase/README.md]

## Description
The first adopter. `User` becomes a served record; `Post` keeps its hand-written adapter so both paths share one Store.

**Size:** M
**Files:** `apps/showcase/src/pages/model.tsx` (the `User` record, `UserApi` and the fake adapter at `:128-166` move out), a new client-safe module for `User` and `UserApi`, `apps/showcase/server/routes/api/users/[id].controller.ts` (new), `apps/showcase/server/user.layer.ts` (new), `apps/showcase/test/model.test.ts`, `server.test.ts`, `architecture.test.ts`, `README.md`

### Approach
- Move `User` and its Tag to a module under `apps/showcase/src/modules/` that imports nothing server-side; mark the server-assigned fields `readOnly` if the record has any, to exercise R1.
- `[id].controller.ts` is `export default records(User)`; `user.layer.ts` default-exports a Layer providing `UserApi` from an in-memory table (a `Ref` per process, as `tally.server.ts` does) that fails `RecordNotFound` and `RecordRejected` as the spec states.
- The model page provides no layer for `User`: it gets the generated browser Layer. `Post` keeps `PostApi` and its fake in the page's layer (`model.tsx:143-166`).
- Tests: drive the page against the app through the existing server test harness (`apps/showcase/test/server.test.ts`) or `callController` (fn-68 task 9); extend `architecture.test.ts` if it lists server files.

### Investigation targets
**Required**:
- `apps/showcase/src/pages/model.tsx:120-234` - the records demo being changed
- `apps/showcase/server/tally.server.ts`, `app.ts` - how fn-69 task 8 leaves the showcase server (Layer Files, Controller)
- `apps/showcase/test/model.test.ts`, `server.test.ts` - harnesses
- `apps/showcase/test/architecture.test.ts` - rules about server files

### Acceptance
- [ ] The model page edits `User` through the generated Layer; `commit` round-trips through the Controller and the in-memory table
- [ ] Saving a missing user surfaces `RecordNotFound`; an invalid body surfaces `RecordRejected` (named tests)
- [ ] `Post` still loads through its hand-written adapter in the same Store and `related` follows the served user
- [ ] `sleekstack check` for showcase is clean; `pnpm turbo run test typecheck --filter=showcase` passes

## Acceptance
- [ ] TBD

## Done summary
Showcase now serves its `User` record. `User` and `UserApi` live in the client-safe `src/modules/users/domain/user.ts`. `server/routes/api/users/[id].controller.ts` is `export default records(User)`, and the Layer File `server/user.layer.ts` holds the users table in a `Ref`; it fails `RecordNotFound` for an unknown id and `RecordRejected` for a name another user already has. The model page provides only `PostApiLive`, so `UserApi` comes from the generated browser Layer in `virtual:sleek/server`, and `Post` keeps its hand-written adapter in the same Store. No mismatch appeared between the by-shape check, the Analyzer's read, the generated Layer (`server.gen.d.ts` now types it with `UserApi`) and the Controller; no other package was edited.

Tests (`apps/showcase/test/model.test.ts`): the records test now stubs `fetch` to `app.fetch` and asserts the PATCH to `/api/users/u1`. Two named tests were added: "saving a user the server no longer has shows RecordNotFound", where the PATCH is pointed at a missing id, and "saving a name the server refuses shows RecordRejected". The stub waits 50 ms before answering, standing in for the old fake's 100 ms sleep, so the existing 'Saving' assertion keeps its strength.

`architecture.test.ts` now has a `users` module, domain code may import `@sleekstack/model`, and `server.gen.d` may reach a module's `domain/`, because the generated types name a record in the module that defines it. The README's Model and Draft row describes both paths. Baseline was green: `pnpm turbo run test typecheck --filter=showcase`.

Follow-ups: none. I did not add a `readOnly` field because the User record has no server-assigned field.

Tier: implementer (actual_model: claude-opus-5-5)
stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: 41d1020fefdbe0304a93887230587eb4f2346274
- Tests: pnpm turbo run test typecheck --filter=showcase, pnpm --filter showcase check, npx prettier --check apps/showcase
- PRs: