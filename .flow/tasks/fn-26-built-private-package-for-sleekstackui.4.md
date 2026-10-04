---
satisfies: [R2, R4]
---
# fn-26-built-private-package-for-sleekstackui.4 tarball consumer test: pack all three, install in a temp project, typecheck and run

## Description
Automated version of the spike: pack core, query and ui, install in a temp project with overrides, typecheck a JSX component, run `mount`, `renderToString` and `./query` in jsdom.

**Size:** M
**Files:** packages/ui/src/__tests__/pack.test.ts (new) or scripts/pack-consumer.mjs, root turbo wiring
**Touches:** [packages/ui/src/__tests__/pack*, scripts/**]

### Approach
- Follow packages/kit/src/__tests__/dts.test.ts (execFileSync pnpm, 60s+ timeout). `pnpm pack` rewrites `workspace:*` to 0.0.1, so the temp project needs `overrides`/`file:` entries for core and query or it hits the registry.
- Assert no `workspace:*` in any packed manifest, effect is a peer, one `effect` copy, source maps resolve, `./query` works (needs `@tanstack/query-core` installed), React guest (react/react-dom installed).

### Investigation targets
**Required** (read before coding):
- packages/kit/src/__tests__/dts.test.ts
- packed manifest fields

## Acceptance
- [ ] Temp-project typecheck and jsdom run pass (R2).
- [ ] A leaked `workspace:*` fails the test; two `effect` copies are called out in README as unsupported (R4).

## Done summary
packages/ui/src/__tests__/pack.test.ts builds and packs core, query and ui, installs the tarballs in a temp project (pnpm-workspace.yaml overrides for core/query, allowBuilds esbuild), runs tsc on a JSX component plus a React guest, bundles with esbuild and runs it under jsdom: renderToString, mount and ./query useQuery all verified. Asserts no workspace:* in packed manifests, effect is a peer (not a dependency), one effect copy installed, ui dist/index.js source map ships with sourcesContent. README gains an Installing section: one effect copy only, two copies unsupported; Node-native ESM unsupported. ui gains @types/node devDependency (lockfile updated) for the test's typecheck.

Note: the test runs `pnpm run build` itself in core/query/ui (turbo test only orders ^build), and installs with --prefer-offline, so it needs network on a cold pnpm store (~7s warm).

Gate: pnpm turbo run test typecheck --filter=@sleekstack/ui... -> 8/8 tasks successful; ui 151 tests passed.

stage: impl-review - skipped(config: conductor requested no review)
## Evidence
- Commits: 71300f55d526a94d2c0f6db468feb7924351705b
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui...
- PRs: