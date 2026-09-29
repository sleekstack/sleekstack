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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
