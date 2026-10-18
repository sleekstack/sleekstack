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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
