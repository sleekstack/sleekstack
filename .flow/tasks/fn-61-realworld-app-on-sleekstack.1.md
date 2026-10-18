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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
