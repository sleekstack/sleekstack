---
satisfies: [R1, R2]
---
# fn-26-built-private-package-for-sleekstackui.1 build spike: tsc-build core and ui, pack, import from a tarball

## Description
Early proof point. Decides the ESM strategy: plain `tsc` with `moduleResolution: Bundler` (bundler-only consumers, documented) and proves a packed ui+core installs and bundles in a temp Vite project. If this forces a different tool, stop and replan.

**Size:** L
**Files:** packages/core/tsconfig.build.json, packages/core/package.json, packages/ui/tsconfig.build.json, packages/ui/package.json
**Touches:** [packages/core/package.json, packages/core/tsconfig.build.json, packages/ui/package.json, packages/ui/tsconfig.build.json]

### Approach
- Model tsconfig.build.json on packages/kit/tsconfig.build.json but emit JS: outDir dist, declaration, sourceMap + inlineSources, noEmitOnError, exclude src/__tests__ and *.test-d.ts; add `type: module`, `files: ["dist"]`, `build: tsc -p tsconfig.build.json`.
- Do not rewrite source imports to `.js`; record in the task summary whether a bundler consumer (Vite/esbuild) resolves the extensionless output, and whether any Node-native import fails (expected: yes, out of scope).

### Investigation targets
**Required** (read before coding):
- packages/ui/tsconfig.json (noEmit true), packages/core/tsconfig.json
- packages/kit/tsconfig.build.json and package.json l.25, 50-54
- tsconfig.base.json

## Acceptance
- [ ] `pnpm --filter @sleekstack/core --filter @sleekstack/ui build` emits dist with JS, d.ts and maps.
- [ ] Packing both and installing them with overrides into a scratch Vite project bundles a `mount` hello-world.

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
