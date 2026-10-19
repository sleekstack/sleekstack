## Goal & Context
<!-- scope: business -->

A RealWorld ("Conduit", https://github.com/realworld-apps/realworld) app at `apps/realworld`, built entirely on SleekStack: `@sleekstack/ui` components, `@sleekstack/router` pages, `@sleekstack/query` and `@sleekstack/model` for data, `@sleekstack/start` for the server. It is the first non-demo, full-stack proof of the stack: sign up, sign in, settings, article feed (global, your feed, by tag, by author, favorited), article CRUD with markdown body, comments, favorites, follows, tags, pagination.

## Architecture & Data Models
<!-- scope: technical -->

One Vite app, modeled on `apps/showcase` (`server/app.ts`, `server/dev.ts`, `src/modules/<domain>/`, ADR layering, `test/architecture.test.ts`).

- **Domain modules** (`src/modules/`): `identity` (User, Profile), `articles` (Article, Tag, Favorite), `comments`. Services are Effect Tags with Layers; server-only services (`Db`, repos) never appear in a client layer (`test/size.test.ts` style check).
- **Storage**: `node:sqlite` file (default `./data/conduit.db`, `:memory:` in tests) wrapped in a server-only `Db` service Layer. Schema created on boot; tables `users`, `follows`, `articles`, `tags`, `article_tags`, `favorites`, `comments`. No new dependency.
- **Auth**: password hashed with `node:crypto` scrypt; JWT-style signed token (HMAC-SHA256, `node:crypto`), sent as `Authorization: Token <jwt>` on REST and stored in a cookie for server functions. Secret from `CONDUIT_SECRET` (dev default).
- **Two server surfaces over the same services**: (1) `@sleekstack/start` server functions used by the UI; (2) a REST `/api` facade following the RealWorld OpenAPI spec (users, user, profiles, articles, feed, comments, favorite, tags), mounted beside `start` in `server/`. Both call the same service functions; no logic is duplicated in the facade.
- **Frontend**: router table with `/` (global feed), `/feed` (your feed), `/tag/:tag`, `/login`, `/register`, `/settings`, `/editor`, `/editor/:slug`, `/article/:slug`, `/profile/:username`, `/profile/:username/favorites`. The router's loaders see only the pathname (no search params), so tab and tag are routes and the page number is a client atom keyed into the query. Forms use Draft (`useDraft`) and Form Actions. Conduit CSS from the RealWorld template (CDN stylesheet link; unstyled offline is accepted).
- **Auth channels**: UI server functions authenticate by an `HttpOnly; SameSite=Lax; Path=/` cookie (start's origin check covers CSRF); REST authenticates by `Authorization: Token` only. Both resolve the viewer through one `Viewer` service. The viewer is resolved per request, so SSR renders the header nav for the signed-in user identically on server and client (seed via the transfer/loader, never a client-only read).
- **REST mounting**: start `handlers` match exact paths only, so the facade is one `middleware` with its own method/path matcher; it maps tagged domain errors to status codes itself (start turns anything else into 500). Dev server (`server/dev.ts`) is widened to route `/api/*` and SSR pages, not only `/_sleek/*`.
- **Markdown**: the body is parsed by a small in-app renderer to ui nodes (headings, paragraphs, emphasis, code, links, lists). ui has no raw-HTML path, so output is escaped by construction.

## API Contracts
<!-- scope: technical -->

REST per the RealWorld spec (`/api/...`, JSON envelopes `{user}`, `{article}`, `{articles, articlesCount}`, `{comments}`, `{tags}`, `{errors:{body:[...]}}` with 422 for validation, 401, 403, 404). Server functions mirror the same operations with typed Schemas and declared errors.

## Edge Cases & Constraints
<!-- scope: technical -->

- Slug from title, unique (numeric suffix, UNIQUE constraint with retry); a title change regenerates the slug and the response carries the new one (confirm against the Postman collection; flip if it expects stability).
- Errors are one tagged set (`ValidationError`, `Unauthorized`, `Forbidden`, `NotFound`) mapped once per surface: REST 422/401/403/404 with `{errors:{body:[...]}}`; wrong login is 403 `{errors:{"email or password":["is invalid"]}}`. A bad or expired token is 401 on every route, optional-auth routes included; no token is anonymous.
- Email/username unique case-insensitively; favorites/follow POST and DELETE are idempotent; no self-follow; `favoritesCount` derived by COUNT; `tagList` sorted, trimmed, deduped; feed order `createdAt DESC, id DESC`; `articlesCount` is the total match; `limit`/`offset` clamp to `[1,100]`/`>=0`, non-numeric -> 422; deleting an article cascades (`PRAGMA foreign_keys=ON`); `data/` is gitignored and created on boot; the server refuses a production boot without `CONDUIT_SECRET`.
- Only the author may update or delete an article; only the comment author may delete a comment (403).
- `favorited`, `following`, `favoritesCount` are viewer-relative; anonymous viewers get `false`.
- `limit` default 20, `offset` default 0; feed requires auth.
- Duplicate email/username -> 422 with field errors.
- Client chunk must contain no server module (size/architecture tests).

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `pnpm --filter realworld dev` serves a working Conduit UI; every flow in the Goal works end to end against SQLite.
- **R2:** The REST `/api` facade passes the official RealWorld Postman/Newman collection against a locally running server on a fresh DB (command in the app README; not in CI), and in-process REST contract tests (envelopes, status codes, auth) run in CI. Errors: malformed JSON or missing envelope key -> 422; unknown route -> 404.
- **R3:** Service-level tests (in-memory SQLite) cover auth, articles, comments, favorites, follows, tags and their error cases; page tests use `@sleekstack/testing` for login, feed, editor and article pages including server render + hydrate.
- **R4:** `pnpm turbo run test typecheck --filter=realworld` passes and `sleekstack check` reports no diagnostics.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck --filter=realworld` · `pnpm --filter realworld dev` · `pnpm --filter realworld check`

## Boundaries
<!-- scope: business -->

No new runtime dependencies beyond workspace packages and Node built-ins (`node:sqlite` is experimental on Node 22 and warns; accepted); no deployment config; no changes to the framework packages (gaps found go to new specs, not silent edits).

## Decision Context
<!-- scope: both -->

Backend scope "both" and `node:sqlite` storage chosen by the user on 2026-10-18. Rejected search-param routing (needs a router change) and a third-party markdown library (new dependency, raw HTML).
