---
satisfies: [R5]
---
# fn-29-sleekstack-vite-plugin.3 Stable component id transform wired into fnId

## Description
Transform assigns each component function a stable id from file path + export name; `fnId` in `packages/ui/src/reactive.ts` consumes it and keeps the counter fallback when the plugin is absent. Enables fn-31.

**Size:** M
**Files:** packages/ui-vite/src/ids.ts, packages/ui/src/reactive.ts, tests in both packages
**Touches:** [packages/ui-vite/src/**, packages/ui/src/reactive.ts, packages/ui/src/__tests__/**]

### Approach
- Deterministic, survives re-export; duplicate id across two files fails the build.
- Modify `fnId` at `packages/ui/src/reactive.ts:206` minimally; check `fnIds` WeakMap use at :204.
- Run the ui verify command (dependents included).

### Acceptance
- [ ] Ids stable across module re-evaluation in a test (R5)
- [ ] Without plugin ids still work (R5)
- [ ] Duplicate id fails build (R5)

## Acceptance
- [ ] TBD

## Done summary
New `ids()` plugin in `packages/ui-vite/src/ids.ts` (wired into `sleekstack()` after `jsx()`): in each ui JSX file, every function written in an export gets the stable id `<path from Vite root, no extension>#<export name>` on `Symbol.for('@sleekstack/ui/component-id')`. That covers declarations, arrows, function expressions, and anonymous default functions, which get a local binding. The id is set once where the function is declared, so re-exports and aliases keep the source id. Two files producing the same id fail the build. `fnId` in `packages/ui/src/reactive.ts` reads the symbol and falls back to the counter when it is absent.

Tests (R5): `packages/ui-vite/src/__tests__/ids.test.ts` evaluates the bundle twice and gets distinct functions with equal ids, covering re-export and alias. It also covers the duplicate-id build failure (`dup/a.tsx` + `dup/a.jsx`) and shows that non-function exports never collide. `packages/ui/src/__tests__/reactive.test.ts` ("component ids") checks that the stable id reaches the instance id and that the counter fallback works without the plugin.

Also fixed task 2's flaky watch-rebuild test in `analyze.test.ts`, in its own commit. macOS FSEvents can report the temp fixture's creation late, which adds a clean rebuild, so the exact-count wait never matched. It now asserts order instead of count. Not done: components defined in plain `.ts` files and non-function-literal exports (`export const X = wrap(...)`) keep the counter. Add those when fn-31 needs them. The README section for ids is left to task 6.

baseline: green (pnpm turbo run test typecheck build --filter=@sleekstack/ui-vite..., turbo cache)
stage: impl-review - ran (codex fan-out NEEDS_WORK: 2 findings fixed, then SHIP on re-review)
## Evidence
- Commits: a6b7b25d3d7a6e1599d92605a50de7c2411e9440, 9ce6ca7fbdb6aca720f7a0fa4e477bcbe02eded5, 18a5d1182221fc8eafe4d2881f72de3252ee7f74
- Tests: pnpm turbo run test typecheck build --filter=@sleekstack/ui-vite..., pnpm turbo run test typecheck --filter=...@sleekstack/ui
- PRs: