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
Realworld's identity is now the `IdentityApi` Server Service. The Tag is in `src/modules/identity/application/contracts.ts`, with 8 methods: register, login, logout, current, update, profile, follow and unfollow. The 8 identity contracts and their `functions` entries are gone. `Account` moved to `domain/model.ts`, because a ServerService file may hold no values. `server/identity-api.server.ts` builds `IdentityApiLive` with `implement`. It takes `Db | TokenSecret` once, when the Layer is built, and reads the session cookie through `Cookies` on every call. `asViewer` and `SESSION` moved there as well; `app.ts` imports `asViewer` for the article and comment functions, which still exist, and re-exports `SESSION`.

Wiring: `serverServices()` is in `vite.config.ts`. The browser entry adds `virtual:sleek/server`. The server entry adds `services` (the registry) and `IdentityApiLive.pipe(Layer.provideMerge(<old layer>))`. The `viewer` and `profile` loaders, `_auth.tsx`, `settings.tsx` and `_profile.tsx` all call `yield* IdentityApi`. The tests use the `IdentityApi.*` wire ids and merge the generated browser Layer next to `ServerFunctions`. Their assertions are unchanged.

`test/architecture.test.ts` changed in three places. The application layer may import `@sleekstack/start/client`, and `main` may import `virtual:sleek/server`. The scan skips `.d.ts` files, since the generated `src/server.gen.d.ts` is one. The client-chunk build test now runs `serverServices()`, so a reachable `*.server.ts` fails it. `sleekstack check` reports MissingDependency when `IdentityApiLive` is left out of the layer (checked by hand, then restored). The effect-app fixture graph output matches /tmp/fixture-before-fn67.json exactly. `pnpm --filter realworld build` passes, and the bundle contains no server code.

baseline: green (pnpm turbo run test typecheck --filter=realworld && pnpm --filter realworld check, pre-edit)

Tier: session (jev-unavailable(no_key)); project routing block pins implementer opus at medium

stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: 570084df4d12f4af558870028c7222e01fe0bd85
- Tests: pnpm turbo run test typecheck --filter=realworld && pnpm --filter realworld check, effect-app fixture graph check (identical), pnpm --filter realworld build
- PRs: