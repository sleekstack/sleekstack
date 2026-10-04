---
satisfies: [R2, R5]
---
# fn-27-streaming-ssr-for-sleekstackui.2 ui stream: boundary chunks, swap script, nonce, nested boundaries

## Description
Each resolved boundary streams an HTML chunk (inside a `<template>` container so table/select contexts parse) plus a small swap script; the swap runtime is emitted once in the shell.

**Size:** M
**Files:** packages/ui/src/stream.ts, packages/ui/src/__tests__/stream.test.ts, packages/ui/src/__tests__/helpers/normalize.ts (new)
**Touches:** [packages/ui/src/stream.ts, packages/ui/src/__tests__/stream*, packages/ui/src/__tests__/helpers/**]

### Approach
- Completion-order queue; a nested boundary's chunk waits for its parent's placeholder; a parent chunk may contain new placeholders; a failed parent interrupts its children's fibers.
- `options.nonce` goes on every inline script (swap runtime and JSON blocks).
- jsdom: scripts set through innerHTML do not run; verify under vitest which works (append `<script>` elements with `runScripts: 'dangerously'`, or evaluate the runtime text) before writing tests; add a normalizer test helper that strips placeholder ids and swap scripts.

### Investigation targets
**Required** (read before coding):
- `packages/ui/src/__tests__/resume.test.ts` setup/afterEach patterns (jsdom id lookup)
- packages/islands/src/__tests__/ssr.test.tsx

## Acceptance
- [ ] After swaps run in jsdom the DOM equals `renderToString` output (normalised) and boundaries arrive in completion order (R2).
- [ ] Nonce is on every inline script (R5).

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
