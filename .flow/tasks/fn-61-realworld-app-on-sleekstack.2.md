---
satisfies: [R1, R3]
---
# fn-61-realworld-app-on-sleekstack.2 Identity and profiles services (users, follows, Viewer)

Touches: apps/realworld/src/modules/identity/**, apps/realworld/server/**, apps/realworld/test/identity*.test.ts

## Description
Server-side services: register, login, current user, update user (partial; empty password = unchanged), profile by username, follow/unfollow (idempotent, no self-follow). A `Viewer` service resolves the optional user from a token (bad/expired token -> `Unauthorized`; none -> anonymous). Client-safe contracts (Schemas, DTOs, errors) live in the module's domain layer so pages can import them.

**Size:** M
**Files:** `src/modules/identity/{domain,application,infrastructure}/*`, `server/identity.ts`, `test/identity.test.ts`

### Approach
- Contracts client-safe, implementations server-only, as `apps/showcase/src/pages/items.ts` vs `server/app.ts`.
- Case-insensitive unique email/username; validation errors keyed by field with official wording (`can't be blank`, `has already been taken`); wrong login -> Forbidden with key `email or password`.
- Tests use in-memory Db and injected clock via `@sleekstack/testing` `callServerFn`/layer swap.

### Investigation targets
**Required**:
- `packages/testing/src/serverFn.ts:7-75`
- `packages/start/src/services.ts:4-40`
- `apps/showcase/src/modules/identity/`

### Acceptance
- [ ] Register/login/update/profile/follow flows pass with all error cases (duplicate email or username in any case, wrong password, self-follow, empty fields, unknown username)
- [ ] Viewer: valid, absent, tampered, expired, deleted-user token cases

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
