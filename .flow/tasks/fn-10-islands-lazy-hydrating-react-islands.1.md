---
satisfies: [R1, R2]
---
# fn-10-islands-lazy-hydrating-react-islands.1 Proof: packages/islands scaffold, Island wrapper (dormant DOM, load/visible), showcase-kit page, Playwright proof

Touches: packages/islands/**, apps/showcase-kit/app/islands/**, apps/showcase-kit/src/islands/**, apps/showcase-kit/e2e/**, .github/workflows/ci.yml

## Description
Scaffold the package and prove the dormant-DOM trick in a real browser before anything else builds on it. Implements `defineIslands`, `<Island>` with the `load` and `visible` triggers only, and a minimal showcase-kit page with one plain Island.

**Size:** M
**Files:** packages/islands/{package.json,tsconfig.json,vitest.config.ts,src/index.tsx,src/Island.tsx,src/triggers.ts,src/__tests__/island.test.tsx}, apps/showcase-kit/app/islands/page.tsx, apps/showcase-kit/src/islands/{islands.client.ts,Counter.tsx}, apps/showcase-kit/e2e/islands.spec.ts, .github/workflows/ci.yml
**Touches:** packages/islands/**, apps/showcase-kit/{app,src,e2e}/islands, .github/workflows/ci.yml

### Approach
- Copy the scaffold shape of `packages/react/{package.json,tsconfig.json,vitest.config.ts}` (private, version 0.0.1, exports map to src, jsdom vitest, peer `react >=19`, dep `@sleekstack/kit: workspace:*`). Add `packages/islands` to the hard-coded package list in `.github/workflows/ci.yml` ('Require test/typecheck scripts').
- `Island.tsx`: the dormant-DOM design from the spec's Architecture section. Container with `data-island`; server child is `React.lazy` + Suspense inside it; client first render is the same container with empty `dangerouslySetInnerHTML` + `suppressHydrationWarning`; a module-level `WeakMap<Element, Root>` guards double hydrate. Trigger logic in `triggers.ts` (`load`, `visible` with IntersectionObserver and `load` fallback, re-arm for hidden containers).
- jsdom tests: `renderToString` a tree then hydrate through the wrapper; assert the Island component does not render on the client before the trigger and renders once after; StrictMode double effect (reuse `apps/showcase-kit/src/__tests__/renderStrict.tsx` idea) hydrates once.
- Playwright (port 3200, `next start`, existing `playwright.config.ts`): load the page, assert no Island client render before scroll, DOM node identity preserved, force a wrapper re-render and assert the Island DOM is not rewritten, assert it becomes interactive after hydration, assert no hydration warnings in the console.

### Investigation targets
**Required**:
- `packages/react/package.json`, `packages/react/tsconfig.json`, `packages/react/vitest.config.ts` - scaffold to copy
- `apps/showcase-kit/playwright.config.ts`, `apps/showcase-kit/e2e/smoke.spec.ts` - e2e pattern
- `apps/showcase-kit/src/__tests__/renderStrict.tsx` - StrictMode helper
- `.github/workflows/ci.yml` - package list

### Key context
This is the spec's early proof point. If the DOM is not preserved across a wrapper re-render or `hydrateRoot` throws, stop and re-evaluate (fallback in the spec) instead of continuing. Next is 15.5, React 19.2.6.

## Acceptance
- [ ] Island server-renders full HTML; client does not render the component until the trigger (jsdom test)
- [ ] `load` and `visible` triggers work, `visible` re-arms for a hidden container, fallbacks without IntersectionObserver
- [ ] StrictMode and same-node remount hydrate at most once
- [ ] Playwright against `next build`: DOM preserved across wrapper re-render, no console hydration warnings, Island becomes interactive
- [ ] Package in CI list; `pnpm --filter @sleekstack/islands test` and `typecheck` pass

## Done summary
Added `@sleekstack/islands` (`defineIslands`, `<Island>` with the `load` and `visible` triggers, the dormant-DOM wrapper, and a per-container activation token), a showcase-kit `/islands` page, jsdom tests and a Playwright proof. The early proof point holds against `next build` + `next start`: the server DOM node survives a wrapper re-render before and after hydration, `hydrateRoot` attaches (node identity is kept and the island is interactive), and the console shows no warnings.

Baseline: none (new package). Inherited, not caused by this task: e2e/smoke.spec.ts "create task" fails on `/` with "A 'use server' file can only export async functions, found object" (it predates fn-10). The task also touched files outside its Touches list, because it cannot build without them: apps/showcase-kit/{package.json,next.config.ts} (the dep and transpilePackages) and pnpm-lock.yaml. It added apps/showcase-kit/src/islands/RerenderHost.tsx as the re-render harness. Follow-up: the `rootMargin` option for `visible` is not built yet.

Tier: opus at medium (conductor IMPLEMENTER)
stage: impl-review - ran (codex fan-out NEEDS_WORK -> re-review SHIP)
## Evidence
- Commits: 0ed5d1966e5b91bf447fd010ba8654702049eda6, 42f4617d5d13c250efc1d56d009550a78157e72c
- Tests: pnpm --filter @sleekstack/islands test, pnpm --filter @sleekstack/islands typecheck, pnpm --filter showcase-kit build && npx playwright test e2e/islands.spec.ts
- PRs: