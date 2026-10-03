---
satisfies: [R3]
---
# fn-22-benchmark-suite-for-the-ui-renderer-and.2 bench: render suites, string and DOM versus React

## Description
Add the fixed 1k-node list tree scenario and the reactive-update scenario to `scenarios.ts`, with a SleekStack adapter (JSX under `@sleekstack/ui`) and a React adapter (`react-dom/server` `renderToString`; `createRoot` + `flushSync` in jsdom; `useState` update).

**Size:** M
**Files:** `apps/bench/src/render-string.bench.ts`, `apps/bench/src/render-dom.bench.ts`, `apps/bench/src/scenarios.ts` (extend)

### Approach
- Report node-swap count for the update case next to time (count mutations via a `MutationObserver` or replaced-node check, outside the measured body).
- Correctness check: serialized HTML (string) or `textContent` (DOM) equal across both before measuring.
- DOM cases skip, never fail, when `gc` is unavailable only if a case needs it; document that jsdom numbers are relative only.

### Investigation targets
**Required**:
- `packages/ui/src/index.ts`, `packages/ui/src/dom.ts`, `packages/ui/src/string.ts`, `packages/ui/src/reactive.ts`
- `apps/ui-demo/src/__tests__` (jsdom mount + atom update test pattern)

### Key context
Spec `.flow/specs/fn-22-benchmark-suite-for-the-ui-renderer-and.md` is authoritative; its Architecture section defines the scenario model, result format and ratio gate.

## Acceptance
- [ ] String and DOM mount cases run for SleekStack and React on the same tree
- [ ] The update case reports time and node-swap count
- [ ] The correctness check fails loudly on a mismatched tree
- [ ] `pnpm --filter bench typecheck` passes

## Done summary
render-string and render-dom (jsdom) suites vs React on the 1k-row list; mount+unmount and one-row reactive update; node swaps counted via MutationObserver outside measurement (sleekstack 2, react 0) and merged into latest.json.
## Evidence
- Commits: 360c5e1
- Tests: pnpm --filter bench bench:json, pnpm --filter bench test, pnpm typecheck
- PRs: