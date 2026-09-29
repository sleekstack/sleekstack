---
satisfies: [R6, R8]
---
# fn-10-islands-lazy-hydrating-react-islands.5 showcase-kit: full Islands page, bundle test, Playwright coverage

Touches: apps/showcase-kit/app/islands/**, apps/showcase-kit/src/islands/**, apps/showcase-kit/src/__tests__/bundle.test.ts, apps/showcase-kit/e2e/**

## Description
Turn the proof page into the real demo: several Islands with different triggers, a shared app-scope service, and a kit `action()` call, plus the bundle test proving deferral.

**Size:** M
**Files:** apps/showcase-kit/app/islands/page.tsx, apps/showcase-kit/src/islands/*, apps/showcase-kit/src/__tests__/bundle.test.ts, apps/showcase-kit/e2e/islands.spec.ts
**Touches:** apps/showcase-kit/{app,src,e2e}

### Approach
- Islands: one per trigger, two of the same name (separate scopes), one calling a kit `action()`, one reading an app-scope service shared with another Island.
- Bundle test in the style of `src/__tests__/bundle.test.ts` (reads `.next/static/chunks/**`, skipped without `.next`, runs via `test:bundle` after `build`): a unique marker string in an Island component is absent from the entry chunks and present in some other chunk, with a non-vacuous positive check.
- Playwright expansions for R1 and R3 across all triggers.
- Ignore stray compiled `.js` / `.d.ts` next to sources so the bundle test cannot match them.
- If fn-9 has landed, keep the page passing `sleekstack check` (fn-9.3).

### Investigation targets
**Required**:
- `apps/showcase-kit/src/__tests__/bundle.test.ts` - marker approach
- `apps/showcase-kit/app/page.tsx`, `apps/showcase-kit/app/providers.tsx` - page and provider layout
- `apps/showcase-kit/src/server/board.actions.ts` - an `action()` example

## Acceptance
- [ ] Islands page renders all trigger kinds; an Island uses `action()` successfully
- [ ] Bundle test: Island code absent from entry chunks, present in a lazy chunk
- [ ] Playwright passes for hydration deferral, preserved DOM and click replay across triggers
- [ ] `pnpm test` and `typecheck` green across the monorepo

## Done summary
Islands showcase page (all four triggers, same-name pair sharing an app-scope service with separate component scopes, interaction Island calling a kit defineEffect Server Action), bundle deferral test, Playwright coverage; prerequisite fixes: process-lifetime server app scope in @sleekstack/islands, test pinning appScope in managedScope adoption (the check already existed).

The coordinator resolved the design conflict: the spec now specifies one process-lifetime server app scope per registry. I also fixed the docs example (the createAppScope @example imports), so `pnpm test` and `pnpm typecheck` are green across the monorepo (R8). The known smoke create-task e2e failure predates this task.

stage: impl-review - ran (codex: round 1 NEEDS_WORK, P2 fixed and P1 resolved by the spec amendment; round 2 SHIP)
Tier: opus at medium
## Evidence
- Commits: c13de78fbab3e327506ff6f8154d8e70b843a2ab, 6e8826b71a38e50889d5f4b1363c4a4c042a3c2c, 5cc68ac4b7c79c532642c9ab442120b74c062a35, 8146e429ef1b14f03a8e9896eee8bdfc86c28b3d, 0703853a66efeefc400eed4da9a2a2656124cfe5
- Tests: pnpm test, pnpm typecheck, pnpm --filter showcase-kit test:bundle, CI=1 pnpm exec playwright test e2e/islands.spec.ts
- PRs: