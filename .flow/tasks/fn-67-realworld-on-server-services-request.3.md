---
satisfies: [R3, R4, R5]
---
# fn-67-realworld-on-server-services-request.3 realworld: wiring and the identity Server Service

## Description
The first migration and the wiring every later one reuses: the standalone plugin in realworld's Vite config, the generated Layer in the browser entry and the registry in the server entry, and `IdentityApi` (register, login, logout, current, update, profile, follow, unfollow) replacing its 8 contracts. Articles and comments still use `ServerFunctions` until their tasks; both mechanisms coexist.

**Size:** M
**Files:** apps/realworld/vite.config.ts, apps/realworld/tsconfig.json, apps/realworld/src/modules/identity/application/contracts.ts (replaced by the Tag), apps/realworld/src/modules/identity/index.ts, apps/realworld/server/identity-api.server.ts (new), apps/realworld/server/app.ts, apps/realworld/src/main.tsx, apps/realworld/src/pages/loaders.ts, apps/realworld/src/routes/_auth.tsx, apps/realworld/src/routes/(guarded)/settings.tsx, apps/realworld/src/routes/profile/_profile.tsx, apps/realworld/test/auth.test.ts
**Touches:** [apps/realworld/**]

### Approach
- Vite: realworld uses only the routes plugin of `sleekstack()` (`vite.config.ts:8`); add the standalone `serverServices()` plugin beside it, and make sure the generated declaration (default `src/server.gen.d.ts`) is inside `tsconfig.json`'s include.
- Contract: one `IdentityApi` `ServerService` Tag in the identity module's application layer (client-safe), its method signatures from today's contract Schemas (`Account` omits the token; keep that shape). The errors (`ValidationError`, `Forbidden`, `Unauthorized`, `NotFound` in `src/errors.ts`) are `Schema.TaggedError` classes, accepted after task 2.
- Implementation: `server/identity-api.server.ts` with `implement(IdentityApi, {...})`; port `signIn`, the logout cookie delete and `asViewer` from `server/app.ts:60-107` without changing behavior: the cookie is read per call.
- Server entry: add the generated registry as `services` and the implementation Layer to the server layer; remove the 8 identity entries from `functions`. Browser entry: add `virtual:sleek/server` to the layers (`main.tsx:7`).
- Pages and loaders that used `ServerFunctions` for identity (`loaders.ts:27`, `_auth.tsx`, `settings.tsx`, `_profile.tsx`) call `yield* IdentityApi`.
- Tests: `test/auth.test.ts` builds `Layer.succeed(ServerFunctions, client)` (line ~71); give it the generated browser Layer for identity alongside it. The existing assertions are the behavior pin.

### Investigation targets
**Required** (read before coding):
- `apps/realworld/server/app.ts:1-135` — `signIn`, `viewerFn`, `functions`, `byId`, `ServerFunctionsInPlace`
- `apps/realworld/src/modules/identity/application/contracts.ts` — the 8 contracts and `Account`
- `apps/realworld/src/errors.ts` — the error classes
- `apps/realworld/src/pages/loaders.ts:20-60` — loaders using `ServerFunctions`
- `apps/realworld/test/auth.test.ts:15-80` — how the test builds its layers
- `packages/start/src/service.ts` and the `implement` added by task 1

**Optional** (reference as needed):
- `apps/showcase/server/app.ts`, `apps/showcase/vite.config.ts` — a Server Service already wired end to end
- `apps/realworld/vite.config.ts`, `src/main.tsx`

## Acceptance
- [ ] `IdentityApi` exists as one Tag with 8 methods; none of the 8 identity contract objects remains; the identity entries are gone from `functions`.
- [ ] Register, login and logout set and clear the session cookie through the implementation; current-user and the other viewer methods read it per call (the existing auth test pins both).
- [ ] Identity pages and loaders call `yield* IdentityApi` with the same code in browser and server.
- [ ] `pnpm turbo run test typecheck --filter=realworld` and `pnpm --filter realworld check` pass; the client bundle holds no `*.server.ts`.
- [ ] The fixture graph check output is identical before and after (AGENTS.md).

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
