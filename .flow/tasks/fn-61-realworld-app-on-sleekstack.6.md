---
satisfies: [R1, R3]
---
# fn-61-realworld-app-on-sleekstack.6 UI shell and auth pages (login, register, settings)

Touches: apps/realworld/src/app.tsx, apps/realworld/src/main.tsx, apps/realworld/src/pages/**, apps/realworld/test/auth*.test.ts

## Description
Router table and shell: header nav that differs for anonymous and signed-in viewers, footer, 404 page. Login, register and settings pages using `useDraft` and Form Actions with inline error lists, redirect to `/` on success, logout from settings. The viewer is seeded for SSR so server and client render the same nav.

**Size:** M
**Files:** `src/app.tsx`, `src/main.tsx`, `src/pages/{shell,login,register,settings}.tsx`, `src/layers.ts`, `test/auth.test.ts`, `test/hydrate.test.ts`

### Approach
- Follow `apps/showcase/src/pages/model.tsx:36-60` (Draft/DraftSpec) and `src/pages/router.tsx` (route table, startRouter).
- Login/logout invalidate the viewer and viewer-relative queries; query keys include the viewer.
- Redirect protected routes to `/login` when anonymous.
- Verify controlled `<input>`/`<textarea>` typing in `packages/ui/src/jsx-types.ts` first.

### Investigation targets
**Required**:
- `apps/showcase/src/pages/{router,model}.tsx`, `apps/showcase/test/{router,hydrate}.test.ts`
- `packages/query/src/ui.ts`, `packages/router/src/{link,server}.ts`

### Acceptance
- [ ] Register, login, settings update and logout work with `@sleekstack/testing`; server errors render as inline lists; draft survives a failed submit
- [ ] SSR + hydrate of the header for anonymous and signed-in viewers without mismatch
- [ ] Routes needing auth redirect when anonymous

## Acceptance
- [ ] TBD

## Done summary
Added the route table, the page shell and the auth pages. `src/app.tsx` holds `pages`, a router over every Conduit route (`src/pages/routes.ts`). Home, login, register and settings are built. Feed, tag, editor, article, profile and favorites render a `Placeholder` for tasks 7 and 8 to replace. A path with no route gets the 404 page. `server/app.ts` now serves `pages`, and `src/main.tsx` runs `startRouter(pages)` over the server-rendered page.

- Viewer seeding: the `ServerFunctions` Tag (`src/pages/functions.ts`) calls a Server Function by its contract. The browser provides `client` stubs (`ServerFunctionsClient`). The server provides `ServerFunctionsInPlace` in `server/app.ts`, which runs the function in place on the request runtime, so it reads the session cookie. The `viewer` loader (`src/pages/layout.tsx`, `user.current`, where Unauthorized means signed out) is declared on every page. Its result rides the hydration payload, so the header matches between server and client and the browser makes no viewer call on load. Tasks 7 and 8 can use the same seam for their SSR loaders.
- Guard: the `signedIn` loader (it reads `viewer`, or redirects to `/login`) is declared on /feed, /settings, /editor and /editor/:slug. On the server that is a 302; in the browser it is a navigation.
- Forms: login, register and settings use `useDraft` with a `useAction` Form Action. `toHome(result, run)` in `src/pages/form.tsx` navigates to `/` once the result is a success. The router then reloads `viewer`, which invalidates it after login, logout or a settings change. A failure renders `<ul class="error-messages">` as `<field> <message>`, and the Draft keeps its edits. Logout is a form on the settings page.
- Settings reads `viewer`, not `signedIn`. After logout the page re-runs while the router leaves it, and the router drops settled loader results at the start of a navigation. A `signedIn` read at that point re-ran the loader and redirected the logout to `/login`; the auth test caught this. This is a router behaviour (it re-runs loaders for the outgoing page). Follow-up candidate for a router spec.
- `sleekstack check` now analyzes the routed pages. Two consequences: the `useAction` hooks are inlined in each component, because a helper generator is a ConditionalSlot; and the header and settings handle `NetworkError` and `DecodeError` from the viewer read (the header falls back to the signed-out links, settings shows an error).
- Module `index.ts` files re-export their contracts, and `server/app.ts` imports through them.
- Outside the listed Touches: `test/architecture.test.ts`. `app` may import `@sleekstack/router`, and `main` may import `effect` and `@sleekstack/router`. A router app's entry cannot be written otherwise. `server/app.ts` and the module indexes were in scope per the dispatch notes. The pages are `pages/layout.tsx` (header, footer, 404, placeholder, home) and `pages/auth.tsx` (login and register), not `shell.tsx`/`login.tsx`/`register.tsx`. CONTEXT.md lists "Shell" as an _Avoid_ term.
- Framework gap (follow-up, not changed here): an atom-bound `value` on a `<textarea>` server-renders as an attribute, which the browser does not display, and hydration does not write it. Settings also renders the bio as the textarea's content.
- Tests: `test/auth.test.ts` (10 cases). It runs in the Node environment and installs a jsdom window, because a jsdom-environment file cannot import `node:sqlite`. Pages come from the real `start` app, are hydrated by `startRouter`, and their calls go through a `fetch` that keeps the HttpOnly cookie. Covered: register, settings update, logout and login end to end; a wrong login and a taken username/email shown as inline lists with the Draft values kept; the anonymous and signed-in header hydrating with the server's DOM adopted, no viewer call and no token in the HTML; 302 to /login for each guarded route; a client-side guard redirect and a signed-in pass; the 404 page.
- Gates: `pnpm turbo run test typecheck --filter=realworld` green (101 tests); `pnpm --filter realworld check` clean.
- baseline: green via handoff (verified at e4379a2 by fn-61-realworld-app-on-sleekstack.5)
- Tier: session (jev-unavailable(no_key))

stage: impl-review - ran (codex fan-out rid b847c667569d4f29b5d94c6274e2a362, 3 draws SHIP)
## Evidence
- Commits: bfe15c4feb780620cb0168a164381de3768b47a9
- Tests: pnpm turbo run test typecheck --filter=realworld, pnpm --filter realworld check
- PRs: