---
satisfies: [R10]
---
# fn-69-server-auto-wiring.10 realworld: identity and articles RPC Files, pages on virtual:sleek/rpc, architecture rules

Touches: [apps/realworld/server/**, apps/realworld/src/**, apps/realworld/test/**, apps/realworld/vite.config.ts]

## Description
Finish R10: the other two Server Services become RPC Files, pages import generated Tags, and the architecture and client-chunk tests follow.

**Size:** M
**Files:** `apps/realworld/server/identity-api.rpc.ts`, `articles-api.rpc.ts` (new; the `*-api.server.ts` files are deleted), `apps/realworld/src/modules/{identity,articles}/application/contracts.ts` (deleted) and their `index.ts`, `apps/realworld/src/routes/_auth.tsx:7`, `_home.tsx:8`, `(guarded)/settings.tsx:6`, `(guarded)/editor/_editor.tsx:6`, `apps/realworld/src/pages/loaders.ts:12-14` (and type uses at `:36,:46-51`), `apps/realworld/test/architecture.test.ts`, `apps/realworld/test/server.test.ts`, `apps/realworld/vite.config.ts`, `apps/realworld/src/server.gen.d.ts`

### Approach
- Identity (cookie session: register, login, logout, current, update, profile, follow, unfollow) and articles (the rest) as RPC Files with written signatures reproducing the contracts; the identity `wrap` is the cookie viewer (`asViewer`, `identity-api.server.ts:18-37`); a non-function export such as `SESSION` stays in the non-RPC module from the previous task.
- Pages and loaders import the Tags from `virtual:sleek/rpc`; extend `architecture.test.ts` (`ruleOf` `:37-89`: `pages/`, `routes/`, module presentation) to allow it while still rejecting server-only imports in pages, and put the discovery plugin in the client-chunk test's plugin list (`:201`).
- Keep wire ids `IdentityApi.*` and `ArticlesApi.*` so `server.test.ts` only changes imports; delete the old contracts, `implement` calls and `*Live` files.

### Investigation targets
**Required** (read before coding):
- `apps/realworld/server/identity-api.server.ts`, `articles-api.server.ts`
- `apps/realworld/src/modules/identity/application/contracts.ts`, `articles/application/contracts.ts`
- `apps/realworld/test/architecture.test.ts:37-212`, `test/server.test.ts`

**Optional**:
- `.flow/memory/bug/integration/lazy-file-routes-links-need-code-2026-10-21.md`

## Acceptance
- [ ] no contract, `implement` call or `*Live` Layer remains in realworld; wire ids are unchanged
- [ ] pages and loaders import generated Tags; the architecture test allows `virtual:sleek/rpc` and still rejects a server-only import in a page
- [ ] the client-chunk test passes with the discovery plugin
- [ ] the whole realworld suite passes with only import and wiring edits
- [ ] `pnpm turbo run test typecheck --filter=realworld` and `pnpm --filter realworld check` pass

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
