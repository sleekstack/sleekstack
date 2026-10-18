# 0042. The RealWorld app: `node:sqlite` storage, cookie and `Authorization` header auth, a REST facade as middleware

## Status

Accepted. Built in spec fn-61. Supersedes nothing.

## Context

`apps/realworld` implements the RealWorld ("Conduit") spec on SleekStack: ui pages, the router, query, model and `@sleekstack/start`. The spec fixes a REST API (`/api/...`, `Authorization: Token <jwt>`, JSON envelopes) and a test collection that runs against it, while the app's own UI talks to the server through server functions (ADR 0039). The app needs storage and authentication, and the repo takes no new runtime dependency for an app.

## Decision

- **Storage.** `node:sqlite` (`DatabaseSync`), wrapped in a server-only `Db` Tag (`server/db.ts`) whose Layer opens the file (`./data/conduit.db`, `:memory:` in tests), creates its directory, turns on `PRAGMA foreign_keys` and creates the schema with `IF NOT EXISTS` statements on every boot. Deleting a user or an article cascades through foreign keys. `node:sqlite` is experimental on Node 22 and prints a warning; that is accepted.
- **Passwords and session JWTs.** `node:crypto` only (`server/crypto.ts`): a salted scrypt hash, and an HS256 JWT signed with `CONDUIT_SECRET`, compared with `timingSafeEqual`, its expiry read from the Effect `Clock` so tests move time with `TestClock`. A production boot without `CONDUIT_SECRET` throws; elsewhere a development default applies.
- **Two auth channels, one viewer.** The UI's server functions read the JWT from an `HttpOnly; SameSite=Lax; Path=/` cookie, and start's origin check covers cross-site requests. The REST facade reads only the `Authorization: Token` header. Both resolve the viewer through one service. A bad or expired JWT is 401 everywhere; no JWT is an anonymous viewer.
- **REST facade as middleware.** start's route handlers match exact paths, so the facade is one start `middleware` with its own method and path matcher. It calls the same service functions as the server functions and maps the tagged domain errors (`ValidationError`, `Unauthorized`, `Forbidden`, `NotFound`, in `src/errors.ts`) to 422, 401, 403 and 404 itself; anything else stays start's 500.
- **Client boundary.** `src/` is client code: `test/architecture.test.ts` fails on an import of `server/` or of any `node:` module from it, and on a client chunk that holds a server-only string.

## Consequences

- The app runs with no database server and no new dependency; tests use an in-memory database per run.
- The domain `NotFound` shares its tag name with the router's `NotFound`. They never meet on the wire (a declared error travels in the `Failure` envelope), but code that catches by tag must pick the right one.
- Gaps the app finds in the framework packages go to new specs, not edits made for the app.

## Rejected

- A SQLite or ORM package from npm: a new dependency for what `node:sqlite` does.
- A third-party JWT or password-hashing library: same reason; `node:crypto` covers HS256 and scrypt.
- REST routes as start route handlers: they match exact paths only, so `/api/articles/:slug/comments/:id` would need one handler per concrete path.
