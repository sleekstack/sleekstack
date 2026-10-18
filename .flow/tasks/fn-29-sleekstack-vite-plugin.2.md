---
satisfies: [R2]
---
# fn-29-sleekstack-vite-plugin.2 Analyzer diagnostics in dev overlay and build

## Description
Run `@sleekstack/analyze` from the plugin: debounced on change in dev, always on build; diagnostics sent to the Vite error overlay with file:line, cleared when fixed. Analyzer crash is reported, never thrown.

**Size:** M
**Files:** packages/ui-vite/src/analyze.ts, src/index.ts, src/__tests__/analyze.test.ts
**Touches:** [packages/ui-vite/src/**]

### Approach
- Reuse the public API from `packages/analyze/src/index.ts`; do not re-implement diagnostics.
- Test with injected fake analyzer: error, fixed, throwing.

### Investigation targets
**Required**:
- `packages/analyze/src/index.ts` - public API
- `packages/analyze/src/errorCodes.ts` - diagnostic shape

### Acceptance
- [ ] Error carries file:line and clears on fix (R2)
- [ ] Analyzer crash reported not thrown (R2)
- [ ] Build fails on analyzer errors

## Acceptance
- [ ] TBD

## Done summary
`sleekstack()` now also runs `@sleekstack/analyze` (graph and component passes, loaded through jiti because the analyzer ships as TypeScript source) over the Vite root's `tsconfig.json`. In dev it runs at startup and debounced on source changes: the first error's absolute file:line goes to the error overlay, and the overlay clears when a run comes back clean. Builds run it once per build cycle (shared across environments, reset on `configResolved` and `watchChange`), and analyzer errors fail the build. An analyzer crash is logged and shown in the overlay in dev and reported as a build warning; it is never thrown. Tests in `packages/ui-vite/src/__tests__/analyze.test.ts` use an injected fake analyzer to cover error with file:line then cleared, crash, fix-before-browser-connect, build failure, rebuild/watch re-analysis and build crash.

Outside the declared Touches: `packages/ui-vite/package.json` and `pnpm-lock.yaml` gained `@sleekstack/analyze`, `jiti` and `typescript` deps, which the plugin needs to run the analyzer.

baseline: green (pnpm turbo run test typecheck build --filter=@sleekstack/ui-vite...)
stage: impl-review - ran (codex fan-out NEEDS_WORK: stale build memo, Vite-buffered stale overlay error; both fixed, SHIP on re-review)
## Evidence
- Commits: 9a28abcaa4d1401eb4ca67ebdff5189f12651044, 3f9f15baf2d1fdc5af22254522009b5b7acaef4a
- Tests: pnpm turbo run test typecheck build --filter=@sleekstack/ui-vite...
- PRs: