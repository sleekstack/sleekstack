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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
