---
satisfies: [R1, R2, R3]
---
# fn-64-router-keeps-the-outgoing-pages-loader.1 Router: stale results are replaced on settle and deleted at commit

Touches: packages/router/src/history.ts, packages/router/src/loader.ts, packages/router/src/resolve.ts, packages/router/src/__tests__/navigation.test.ts, packages/router/README.md, apps/docs/content/docs/routing.mdx

## Description
Write the failing repro first, then change the router so a navigation records the settled results as stale instead of deleting them, `resolve` loads a stale key fresh and replaces it on settle, and the stale leftovers are deleted once the swap commits. The page being left keeps reading what it holds; nothing redirects or reloads from it.

**Size:** M
**Files:** `packages/router/src/history.ts`, `packages/router/src/loader.ts`, `packages/router/src/resolve.ts` (only if `resolve` is where the stale check must live), `packages/router/src/__tests__/navigation.test.ts`, `packages/router/README.md`, `apps/docs/content/docs/routing.mdx` (only if it states the drop rule)

### Approach
- Tests first in `navigation.test.ts` (jsdom `startRouter` describe ~line 179, helpers `start`, `flush`, `act`; module-level `app` with the `user` loader and `calls`/`stopped`/`failures` counters). Repro recipe: add a route whose `function*` page reads an atom and `useLoader(user)`; start on it; `navigate` to a page whose loader never settles; write the atom inside `act`; `calls` must not rise. Existing test at ~198-214 (`expect(calls).toBe(2) // a navigation loads again`) and ~242 (latest navigation wins) must keep passing.
- The drop today is `history.ts:71`, in `go()` after `Fiber.interrupt(nav)`; the old page stays mounted until `show` (~85). `useLoader` (`loader.ts:88-101`) misses and calls `start()`; a failure escaping the old page's read reaches `onError` -> `go(c.to)`.
- Mechanism (contract, not code): at `go()` start record the held entries that are settled and not unread prefetches (the current drop set, by entry identity) and delete none. Give `resolve` (and only `resolve`: its layer is built in `go()` at ~`Layer.merge(Layer.succeed(Loaders, all), base)`) a way to treat a recorded entry as a miss: start a fresh load and replace the entry when it settles, so the key is never empty. Mounted pages do not see the record. After `yield* Effect.promise(() => show(...))`, and only if `nav` is still this navigation's fiber, delete the recorded entries that were not replaced, plus entries created for intermediate redirect hops (held results and `failure` entries whose pathname is not the shown one). `keyOf` is `JSON.stringify([key, pathname without trailing slash])`: compare by decoding or keep a pathname on the held entry.
- Never touch entries that are loading, unread prefetches (have `expires`), or held failures of the shown page awaiting their one replay. A navigation that is interrupted, external, a redirect loop or a defect commits nothing and deletes nothing.
- Update the comments at `history.ts:24` and `:70` ("Each navigation loads again (R11)") and the README line ~69 ("Each browser navigation loads again; a failed loader runs once...") to state when results are dropped. AGENTS.md: a changed decided behavior needs an ADR - read ADRs 0036, 0039, 0043 for a statement of "loads again" and add or amend one only if they state it.

### Investigation targets
**Required**:
- `packages/router/src/history.ts:45-110`, `packages/router/src/loader.ts:60-130`, `packages/router/src/resolve.ts:90-130`
- `packages/router/src/__tests__/navigation.test.ts:179-260`
- `packages/router/README.md:60-75`

### Acceptance
- [ ] Repro tests fail before the change and pass after: outgoing page re-render during a pending navigation runs no loader and no redirect; a guard loader on the outgoing page that would redirect does not fire
- [ ] Same-key navigation (same pathname, and a search-only change): the incoming load runs once with fresh data, the outgoing instance never sees an empty key; back/forward loads fresh
- [ ] Superseded navigation: the shown page's results stay readable and the older commit prunes nothing of the newer one; interrupted loads still stop (existing test)
- [ ] Redirect chain: after commit only the shown pathname's results are held (checked through load counts: an undeclared read of an intermediate path loads again); an unread prefetch survives and a prefetch of the incoming path is used; a held failure for the shown page is replayed once
- [ ] Hydrate then navigate: the first navigation clears the hydrated entries like any other
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/router...` green

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
