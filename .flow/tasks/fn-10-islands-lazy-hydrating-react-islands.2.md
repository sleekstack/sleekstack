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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
