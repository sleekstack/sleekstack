---
satisfies: [R1, R4]
---
# fn-61-realworld-app-on-sleekstack.1 Scaffold apps/realworld, Db service, auth crypto, CI and ADR

Touches: apps/realworld/**, .github/workflows/ci.yml, AGENTS.md, README.md, .gitignore, docs/adr/**

## Description
Copy the `apps/showcase` shape into `apps/realworld` (package.json, vite.config.ts, tsconfig, index.html with the Conduit CDN stylesheet, `src/modules/` layering, `test/architecture.test.ts` rules and the client-chunk-has-no-server-module check; drop devtools and gzip budgets). Add the server-only `Db` Layer over `node:sqlite` (idempotent schema, `PRAGMA foreign_keys=ON`, `:memory:` in tests, `data/` created on boot and gitignored), the tagged domain error set, and `node:crypto` helpers (scrypt hash/verify, HMAC token sign/verify with `timingSafeEqual`, injected clock). Wire CI and docs.

**Size:** M
**Files:** `apps/realworld/{package.json,vite.config.ts,tsconfig.json,index.html,src/layers.ts,src/modules/*/,server/db.ts,server/crypto.ts,test/architecture.test.ts,test/db.test.ts,test/crypto.test.ts}`, `.github/workflows/ci.yml`, `AGENTS.md`, `README.md`, `docs/adr/0042-*.md`, `docs/adr/README.md`

### Approach
- Mirror `apps/showcase/package.json`, `vite.config.ts:5-16`, `tsconfig.json`, `test/architecture.test.ts:19-78` (MODULE_DEPS/ruleOf, every src file needs a rule).
- CI: add `apps/realworld` to the script-presence list, the `sleekstack check` step and a build step (not Newman). Add `"sleekstack": {"entry": [...]}` only if check reports no roots.
- AGENTS.md verify-table row and a README line; ADR 0042 records SQLite + cookie/Token auth + REST via middleware (check CONTEXT.md `_Avoid_` terms first).

### Investigation targets
**Required**:
- `apps/showcase/package.json`, `apps/showcase/vite.config.ts`, `apps/showcase/test/architecture.test.ts`
- `apps/showcase/server/app.ts`, `.github/workflows/ci.yml`
- `docs/adr/README.md`, `CONTEXT.md`

### Acceptance
- [ ] `pnpm turbo run test typecheck --filter=realworld` and `pnpm --filter realworld check` pass on the scaffold
- [ ] Db: schema creation idempotent; foreign keys enforced; cascade delete verified
- [ ] Crypto: wrong password, tampered token and expired token each rejected; production boot without `CONDUIT_SECRET` throws
- [ ] Architecture test fails if client code imports `server/` or `node:sqlite`/`node:crypto`

## Acceptance
- [ ] TBD

## Done summary
Scaffolded `apps/realworld` on the showcase shape. It has the Conduit CDN stylesheets, three module indexes (identity, articles, comments), and the tagged error set in `src/errors.ts` (ValidationError, Unauthorized, Forbidden, NotFound as Schema.TaggedError). It also adds a server-only `Db` Layer over `node:sqlite` (idempotent `IF NOT EXISTS` schema, foreign keys on, cascades, `data/` created on boot and gitignored) and `server/crypto.ts`: scrypt hash/verify, HS256 JWT sign/verify with `timingSafeEqual` on the Effect Clock, and `conduitSecret()`, which throws on a production boot without CONDUIT_SECRET. The commit also covers CI, the AGENTS.md row, a README line, and ADR 0042 with its index row.

- Tests: `test/db.test.ts` checks idempotent reboot, data-dir creation, FK enforcement and article cascade. A mutation check (pragma OFF) turns the FK and cascade tests red. `test/crypto.test.ts` covers a wrong password, a tampered payload, another secret, a malformed token, expiry on TestClock, and the production secret throw. `test/architecture.test.ts` has the layering rules with the `node:` allowance removed. A unit case shows that `server/`, `node:sqlite` and `node:crypto` imports from src are violations, and a client-chunk build check confirms no server markers reach the client.
- `sleekstack check` finds the `mount` component root, so no `sleekstack.entry` is needed.
- pnpm-lock.yaml gains the realworld importer (required by the new package). A local-only `apps/sleek-codes` importer, which is excluded through .git/info/exclude, was stripped from the lockfile.
- Vite config has no plugins yet (no React plugin; ui JSX uses the per-file pragma). Task 4 adds the dev middleware.
- Note for later tasks: the domain `NotFound` shares its tag with the router's `NotFound`. They don't collide on the wire, and ADR 0042 records this.
- `baseline: none` (the app did not exist before this task).
- Tier: session (jev-unavailable(no_key))

stage: impl-review - ran (codex fan-out, 3 draws SHIP, rid c27ae423214c4976a116ef4bf842eadc)
## Evidence
- Commits: efe04e56bd8cb0fb35351bb9a65ade0059581501
- Tests: pnpm turbo run test typecheck --filter=realworld, pnpm --filter realworld check
- PRs: