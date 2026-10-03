---
satisfies: [R3]
---
# fn-16-query-layer-follow-ups-kit-ssr-prefetch.2 showcase-kit: hydrate board() from a server prefetch + e2e

## Description
Make showcase-kit render the board from server prefetch instead of client-only fetch.

**Size:** S
**Files:** apps/showcase-kit/app/page.tsx, apps/showcase-kit/src/client/Board.tsx, apps/showcase-kit/src/client/board-query.ts, apps/showcase-kit/e2e/smoke.spec.ts
**Touches:** [apps/showcase-kit/**]

### Approach
- Mirror the core showcase prefetch (`apps/showcase/src/delivery/runtime.server.ts`, `apps/showcase/src/client/services/board-query.ts`) using the kit facade from task 1.
- A failed prefetch falls back to the existing client fetch.
- Extend the Playwright smoke: server HTML contains the board; no client query request on first paint.

## Acceptance
- [ ] first server HTML contains the board; smoke test asserts no client fetch on first paint
- [ ] failed prefetch falls back to client fetch without a crash

## Done summary
showcase-kit's page prefetches `board()` through kit `prefetch` and passes the state to `<HydrateQueries>` in Providers. The board is in the server HTML and the client does not fetch it on first paint. A failed prefetch falls back to the client fetch (tested in src/__tests__/page.test.tsx, confirmed red without the catch). The board query moved to src/client/board-family.ts with no React imports, so the RSC page can import it. Its name avoids `board.ts`, which resolves to `Board.tsx` on case-insensitive macOS. It sets `serializable: true` and `staleTime: 30_000`, because without a staleTime the hydrated board was refetched on mount. The create-task form now mounts after hydration, because kit `useMutation` throws in a server render. Follow-up: remove that gate in ProjectView.tsx once fn-16.3 (R4) lands. Playwright: `pnpm build && CI=1 npx playwright test` passed 14/14, including the new test checking the board is in the server HTML and no readBoard Server Action POST runs on first paint.

Tier: opus at medium
stage: impl-review - ran (codex fan-out, 3 draws SHIP)
## Evidence
- Commits: 5fc9f3d668316f518c7c45592aaf2ba7230b4431
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/kit --filter=@sleekstack/query --filter=@sleekstack/react --filter=./apps/showcase-kit, cd apps/showcase-kit && pnpm build && CI=1 npx playwright test (14 passed)
- PRs: