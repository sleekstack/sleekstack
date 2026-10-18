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
Added the identity services: register, login, current user, partial update (an empty password stays unchanged), profile, idempotent follow/unfollow with no self-follow, and `ViewerLive(token)`, which resolves an optional viewer and rejects bad, expired or deleted-user tokens as `Unauthorized`. Client-safe contracts (User/Profile/NewUser/LoginUser/UpdateUser Schemas, the `Viewer` Tag, `requireFields`) live in `src/modules/identity`, and the implementations are server-only in `server/identity.ts` (with a `TokenSecret` Tag + `TokenSecretLive`).

- Uniqueness is case-insensitive (NOCASE columns). A pre-check gives field errors for both fields (`has already been taken`), and a UNIQUE-constraint fallback covers concurrent writes. Blank or whitespace fields fail as `can't be blank`. A wrong login or unknown email gives Forbidden `{"email or password": ["is invalid"]}`, and an unknown email still pays for a hash. Self-follow is a `ValidationError` on `username`.
- `updateUser` writes only the supplied columns. Codex review found a lost update across the async scrypt, and whitespace passwords being accepted; both are fixed with regression tests.
- Tests: `test/identity.test.ts` (22 cases) covers every flow and the error cases from the ACs, plus Viewer valid/absent/tampered/expired (TestClock)/deleted-user. It runs on in-memory SQLite with the layers swapped. The tests target services, not server functions (task 4 adds those). Mutation checks turned the deleted-user, own-username-case and empty-password tests red.
- No `infrastructure/` layer: in src it cannot import `server/` or `node:`, so the implementations sit in `server/identity.ts`.
- `baseline: green via handoff (verified at 824c9f8 by fn-61-realworld-app-on-sleekstack.1)`
- Tier: session (jev-unavailable(no_key))

stage: impl-review - ran (codex fan-out rid 65b68ca2c5044750aa276dac8f2f9c35 NEEDS_WORK x3 -> fix e6f586c -> re-review SHIP)
## Evidence
- Commits: 72e4f140c67e0c84ce5ab1e1f3f3481b0c8db048, e6f586c67694c90159a39c27c115c4f0a878b103
- Tests: pnpm turbo run test typecheck --filter=realworld, pnpm --filter realworld check
- PRs: