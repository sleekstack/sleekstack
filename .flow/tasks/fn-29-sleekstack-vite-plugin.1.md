---
satisfies: [R1]
---
# fn-29-sleekstack-vite-plugin.1 Scaffold packages/ui-vite with pragma-aware JSX plugin

## Description
New workspace package `@sleekstack/ui-vite` exporting `sleekstack(options?)`. First step: check Vite's current plugin and environment API and record the finding in the package README. No global `jsxImportSource`; ui JSX stays pragma-driven (ADR 0015), include/exclude globs optional; coexists with plugin-react for guest files.

**Size:** M
**Files:** packages/ui-vite/{package.json,tsconfig*.json,vitest.config.ts,src/index.ts,src/jsx.ts,src/__tests__/jsx.test.ts}
**Touches:** [packages/ui-vite/**, pnpm-workspace.yaml, pnpm-lock.yaml]

### Approach
- Mirror package layout of `packages/router` (package.json, tsconfig.build.json, vitest.config.ts).
- Test: a fixture Vite build compiles pragma'd ui TSX and React guest TSX side by side.

### Investigation targets
**Required**:
- `packages/router/package.json` - package layout to copy
- `packages/ui/src/jsx-runtime.ts` - runtime the pragma points at
- `docs/adr/` ADR 0015 - JSX opt-in decision

### Acceptance
- [ ] Fixture build compiles both JSX flavors (R1)
- [ ] File with neither pragma nor include match is left to default (R1 error case)
- [ ] Vite API check recorded in README

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
