---
satisfies: [R6]
---
# fn-65-file-routes-page-config-layouts-routing.6 Router: Page.load and awaiting a page's code before loaders and render

Touches: packages/router/src/resolve.ts, packages/router/src/history.ts, packages/router/src/server.ts, packages/router/src/__tests__/navigation.test.ts, packages/router/README.md

## Description
`Page` gets an optional `load: () => Promise<{ render, loaders?, fallback? }>`. Everything that reads a page's `render`, `loaders` or `fallback` first awaits the page's code, once: `resolve`, the client history (including the first page before hydration) and the server `handle`.

**Size:** M
**Files:** `packages/router/src/resolve.ts`, `packages/router/src/history.ts`, `packages/router/src/server.ts`, `packages/router/src/__tests__/navigation.test.ts`, `packages/router/README.md`

### Approach
- Readers today: `resolve` reads `r.pages[name].loaders` (`resolve.ts` ~117), `view(page)` reads `render` / `fallback` (`resolve.ts:~36`), `history.ts` and `server.ts` call `resolve` / `view`. Find every read of those three fields (grep) and route them through one helper that returns the loaded page.
- Contract: a page with `load` and no `render` loads its module once (the promise is cached on the page, shared by concurrent navigations) before its loaders run; a page without `load` behaves as today. The first page of `startRouter` is loaded before hydration (no markup mismatch). A rejected import fails the navigation with a typed failure that reaches the nearest `Boundary` (look at `LazyLoadError` in `packages/ui/src/lazy.ts`), is not cached, and a later navigation tries again. Interrupting a navigation does not cancel a load another navigation shares; the interrupted navigation just stops waiting.
- Interaction with fn-64: awaiting code happens inside `resolve` before loaders run; the stale record and commit-time deletion are unchanged. Check `navigation.test.ts` still passes untouched.
- `Link`: no code change. Its `code` prop accepts `pages.<name>.load`; add a README line.
- Tests first: fake pages with a controllable `load` (first navigation waits, second concurrent navigation shares, rejection then retry, interrupt keeps the shared load, hydrate-then-navigate, `handle` awaits it). Follow `navigation.test.ts` helpers (`start`, `flush`, `act`).

### Investigation targets
**Required**:
- `packages/router/src/resolve.ts`, `packages/router/src/history.ts`, `packages/router/src/server.ts`
- `packages/ui/src/lazy.ts`, `packages/router/src/__tests__/navigation.test.ts`

### Acceptance
- [ ] A page with `load` is loaded once before its loaders run; concurrent navigations share the load; the first page loads before hydration
- [ ] A rejected load fails that navigation at the nearest Boundary and a later navigation retries; an interrupted navigation leaves a shared load running
- [ ] A page without `load` and the existing navigation tests behave as before; `handle` answers a lazy page after awaiting its code
- [ ] README documents `Page.load` and `Link`'s `code={pages.<name>.load}`
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/router...` green

## Acceptance
- [ ] TBD

## Done summary
`Page` is now `PageCode | { load }`. The router loads a page's code once before its loaders run or it renders: in `resolve` (and through it `handle` and each navigation) and, in `startRouter`, before it hydrates the first page. The promise is cached per page in a WeakMap and shared by concurrent navigations and requests. Interrupting a navigation stops only its wait, not the load. A rejected load, a synchronous throw from `load`, or a module with no `render` is not cached: that page renders a `LazyLoadError` (from `@sleekstack/ui`) to the nearest `Boundary`, or to `onError` when no Boundary exists, and the next navigation loads again. `Resolved` now carries the loaded `code` for history and server to render. `PageNeeds` also infers requirements through `load`'s return. `startRouter` registers its click and popstate listeners only after the first page's code has loaded, so a click before hydration goes to the browser. `Link` is unchanged. The README documents `Page.load` and `code={pages.<name>.load}`.

Tests in `packages/router/src/__tests__/navigation.test.ts` ("a page with load"):
- `handle` awaits the code, and concurrent requests share one load
- a navigation loads the code once before its loaders
- an interrupted navigation keeps the shared load running
- an async or sync rejection reports `LazyLoadError`, then a retry succeeds
- the first page loads before hydration
- a click during the first load goes to the browser and hydration completes

The existing navigation tests are unchanged and pass.

baseline: green (`pnpm turbo run test typecheck --filter=@sleekstack/router...`)

Tier: implementer (project routing block: opus at medium)
stage: impl-review - ran (codex fan-out rid b0ecfb7249034cfe9544f49dfd277d93: NEEDS_WORK on two findings, the hydration/navigation race and a sync load() throw; both fixed in dbe1bfcd; re-review SHIP)
## Evidence
- Commits: 0af2a9def5a98904cb38023aceee4d6724e172ca, dbe1bfcd5edddeb4384e20728073059beefd54b4
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/analyze --filter=sleekstack --filter=realworld
- PRs: