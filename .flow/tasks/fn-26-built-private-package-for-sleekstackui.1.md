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
core and ui build with plain `tsc -p tsconfig.build.json` to `dist/` (ESM JS, .d.ts, source maps with inline sources, noEmitOnError; tests excluded); both packages gain `type: module`, `files: ["dist"]` and a `build` script. Spike result: plain tsc holds, no bundler needed.

Spike (scratchpad script, not committed): packed core, ui and query; rewrote core/ui manifests in the extracted tarball to point main/types/exports at dist (the real manifests still point at src; task .3 owns that); installed into a scratch Vite 7 project with pnpm 11 overrides in pnpm-workspace.yaml (pnpm 11 ignores `pnpm.overrides` in package.json, and esbuild needs `allowBuilds`). `vite build` bundled a `mount(jsx('h1'), { layer: Layer.empty, container })` hello-world: 676 modules, 604.8 kB / 191.8 kB gzip (no tree-shaking work yet). One effect copy. Vite resolves extensionless output; Node-native `import('@sleekstack/ui')` fails with ERR_MODULE_NOT_FOUND, as expected (out of scope). query was packed as TS source, and Vite bundled it as-is. No `workspace:*` leaked after pack.

stage: impl-review - skipped(config: conductor requested no review)
## Evidence
- Commits: eac2e44779a410db40e989a726afd99d191a7482
- Tests: pnpm --filter @sleekstack/core --filter @sleekstack/ui build, pnpm turbo run test typecheck --filter=...@sleekstack/core, scratch Vite tarball install + vite build
- PRs: