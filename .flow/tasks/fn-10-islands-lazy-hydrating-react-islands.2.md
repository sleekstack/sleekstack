---
satisfies: [R2, R3]
---
# fn-10-islands-lazy-hydrating-react-islands.2 Islands: idle and interaction triggers with click replay

Touches: packages/islands/src/triggers.ts, packages/islands/src/replay.ts, packages/islands/src/__tests__/**, apps/showcase-kit/e2e/islands.spec.ts

## Description
Add the `idle` and `interaction` triggers and the click replay described in the spec's Architecture (Triggers and Replay bullets).

**Size:** M
**Files:** packages/islands/src/{triggers.ts,replay.ts,Island.tsx}, packages/islands/src/__tests__/{triggers,replay}.test.tsx, apps/showcase-kit/e2e/islands.spec.ts
**Touches:** packages/islands/src/**, apps/showcase-kit/e2e

### Approach
- `idle`: `requestIdleCallback` with `setTimeout` fallback and a timeout cap.
- `interaction`: capture-phase listeners on the container for pointerdown, touchstart, focusin, keydown, click; the first one starts hydration; only a `click` is recorded for replay; a second click while loading is dropped.
- `replay.ts`: after `hydrateRoot` commits, re-dispatch a cloned `click` on the original target unless it is a link, checkbox or radio input, label, submit button or `summary`, or has been detached (then drop silently).
- Unit tests in jsdom for the decision logic; Playwright for real behavior: first click on a plain button fires the handler exactly once; a checkbox and a link are not double-toggled or double-navigated; keydown/focus only start hydration.

### Investigation targets
**Required**:
- `packages/islands/src/Island.tsx`, `packages/islands/src/triggers.ts` (from task 1)
- `apps/showcase-kit/e2e/islands.spec.ts` (from task 1)

## Acceptance
- [ ] `idle` fires via requestIdleCallback and via fallback
- [ ] `interaction` hydrates on first of the listed events; click on a non-native-activating target runs its handler exactly once after hydration
- [ ] Links, checkbox, radio, label, submit and summary are not replayed; detached target drops silently
- [ ] Playwright covers first-click-once and checkbox no-double-toggle

## Done summary
Added the `idle` trigger (requestIdleCallback with a 2s timeout cap, setTimeout fallback), the `interaction` trigger (capture-phase pointerdown/touchstart/focusin/keydown/click; the first click is kept and replayed once the Island's Suspense boundary commits), `replay.ts` (skips links, checkbox/radio, labels, summary, form submit buttons, detached targets), the `rootMargin` option for `visible`, and interaction retry after a chunk load failure (review finding). Tests: island.test.tsx (interaction click-once, keydown/focusin, retry, idle rIC + fallback, rootMargin, interaction arm) and replay.test.tsx (decision table, detached drop); Playwright e2e/islands.spec.ts covers first-click-once, checkbox no-double-toggle, link not replayed, focus/keydown only hydrate.

Outside the Touches list, needed by the Playwright tests: apps/showcase-kit/src/islands/Controls.tsx (new island), islands.client.ts (registers it), app/islands/page.tsx (four interaction sections). Replay note: the commit hook sits inside the Suspense boundary, because Suspense content hydrates in its own pass after the shell.
Inherited, not caused: e2e/smoke.spec.ts "create task" fails with "A 'use server' file can only export async functions"; reproduced on base 4b5caa6 in a temp worktree.
Baseline: green (islands test + typecheck).

Tier: opus at medium (conductor IMPLEMENTER)
stage: impl-review - ran (codex fan-out NEEDS_WORK -> re-review SHIP)
## Evidence
- Commits: aae6ce832f2cbbebe4d1846a370fe76c99b35ea7, 8e630c2f5ea38a4ab2e8c4e18c56b22344f1523a
- Tests: pnpm --filter @sleekstack/islands test, pnpm --filter @sleekstack/islands typecheck, pnpm --filter showcase-kit build && playwright test (islands 5/5 pass; smoke create-task fails, inherited)
- PRs: