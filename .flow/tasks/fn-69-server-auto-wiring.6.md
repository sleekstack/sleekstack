---
satisfies: [R1, R2, R12]
---
# fn-69-server-auto-wiring.6 ui-vite: Layer File and Server Root composition into the discovered app

Touches: [packages/ui-vite/src/server-services.ts, packages/ui-vite/src/__tests__/**]

## Description
Emit the composed Layer of the Layer Files and the Server Root's `onError` into `virtual:sleek/server-app`, with dev parity for the new kinds (R1, R2, R12).

**Size:** M
**Files:** `packages/ui-vite/src/server-services.ts`, `packages/ui-vite/src/__tests__/server-services.test.ts`, a new fixture `layer-files/`

### Approach
- Generate the composed Layer in the analyzer's order (path codepoint), providing the generated implementation Layers and shadowed by the explicit `layer`; a failing Layer build fails the first request and every later one with the same cause, never a half-built app.
- Emit the Server Root's `onError` (default `console.error`).
- Dev and build: `*.layer.ts` and `_app.ts` add, remove, rename and edit regenerate and invalidate the modules; the declaration is sorted and a stale one fails `vite build`; works under vitest. Tests that read env at Layer File import set it before importing the app (realworld pattern).
- Keep the Layer-File exclusion (`__tests__/`, `test/`, `tests/`, `*.test.*`, `*.spec.*`) identical to the analyzer's by consuming the shared predicate.

### Investigation targets
**Required** (read before coding):
- `packages/ui-vite/src/server-services.ts:171-284`
- the analyzer's Layer File pass (task 1)
- `apps/realworld/server/app.ts:28-35` - what the composition replaces

**Optional**:
- `.flow/memory/bug/integration/vite-plugin-memo-must-reset-per-build-2026-10-18.md`

## Acceptance
- [ ] a fixture app with three Layer Files and an explicit `layer` runs through `start()` with no Layer list; the explicit `layer` shadows a Layer File's Tag
- [ ] a failing Layer build fails every request with the same cause
- [ ] a Layer File under `test/` is not composed; dev add/remove/edit tests pass
- [ ] the committed declaration is sorted and typechecks
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui-vite...` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
