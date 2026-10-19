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
Added `@sleekstack/ui-vite` with `sleekstack({ include?, exclude? })`. It sets no global `jsxImportSource`. Pragma'd files compile against `@sleekstack/ui/jsx-runtime` through Vite 8's oxc transform, and include-matched files get the pragma prepended (with a magic-string source map). Every other file, including plugin-react guests, keeps the default. The fixture build in `src/__tests__/jsx.test.ts` covers pragma'd ui, include-matched ui, a React guest, an excluded file, and an include-matched file whose `@jsxImportSource` text is not a leading pragma (the R1 error case). The README records the Vite 8.0.16 / plugin-react 6 plugin and Environment API check.

Review fixes: the package uses NodeNext resolution with `.js` imports so `dist/index.js` loads in Node from vite.config, and the pragma is detected only in leading comments, as oxc does.

baseline: none (package did not exist pre-edit)
stage: impl-review - ran (codex fan-out NEEDS_WORK, then SHIP on re-review)
## Evidence
- Commits: a87b87bd33f8ef07b94401fbcd6f3a597f5ed9fa, 158622a96c39f001e0bd7a0fa7f18ed2ced415ac
- Tests: pnpm turbo run test typecheck build --filter=@sleekstack/ui-vite...
- PRs: