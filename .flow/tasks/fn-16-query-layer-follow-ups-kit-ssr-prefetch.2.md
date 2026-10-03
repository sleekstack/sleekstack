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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
