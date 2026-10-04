---
satisfies: [R3, R6]
---
# fn-26-built-private-package-for-sleekstackui.5 ui-demo on built packages; playground stops emitting build output

## Description
ui-demo already imports through public entry points; once exports point at dist it consumes the build. Fixes the stray emit: the root tsconfig has no `noEmit`/`include`, so a root `tsc` emits next to sources.

**Size:** S
**Files:** apps/ui-demo/*, apps/playground/tsconfig.json (new), apps/playground/package.json, tsconfig.json, .gitignore
**Touches:** [apps/ui-demo/**, apps/playground/**, tsconfig.json, .gitignore]

### Approach
- Verify ui-demo test/typecheck with built deps; add apps/playground/tsconfig.json (extends base, noEmit, include src) and a typecheck script; set `noEmit` on the root tsconfig; delete the untracked emitted files; consider a clean-tree-after-build check.

### Investigation targets
**Required** (read before coding):
- apps/ui-demo/vite.config.ts
- apps/playground/package.json
- tsconfig.json

## Acceptance
- [ ] ui-demo resolves `@sleekstack/ui` to dist and its tests pass (R3).
- [ ] A root `tsc` run leaves no untracked files (R6).

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
