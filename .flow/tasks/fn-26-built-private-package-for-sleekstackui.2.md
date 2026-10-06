---
satisfies: [R1, R4]
---
# fn-26-built-private-package-for-sleekstackui.2 build core and query; turbo build ordering

## Description
Same build for core and query, `effect` and `@tanstack/query-core` as peers, `sideEffects: false`, and turbo ordering so a clean checkout works.

**Size:** M
**Files:** packages/core/package.json, packages/query/package.json, packages/*/tsconfig.build.json, turbo.json
**Touches:** [packages/core/**, packages/query/**, turbo.json]

### Approach
- Add `exports` (core has none; also expose `src/atom` only if something imports it), peers, devDependencies for tests.
- turbo.json: `typecheck` and `test` get `dependsOn: ["^build"]` (they have none today); core/query/ui dependents (react, kit, runtime, analyze, apps) must still pass: run the AGENTS.md core verify row.

### Investigation targets
**Required** (read before coding):
- turbo.json build/test/typecheck
- packages/query/package.json deps

## Acceptance
- [ ] core and query build; `effect` is a peer in both packed manifests (R4).
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/core...` green on a clean checkout.

## Done summary
core and query build with tsc to dist; main/types/exports point at dist, sideEffects false, effect (and @tanstack/query-core for query) are peers plus devDependencies; turbo test/typecheck depend on ^build. Packed manifests verified: effect is a peer, no dependencies, maps included.

Knock-on fixes outside Touches (required by dist resolution): analyze libId regex accepts dist/*.d.ts (else every core-declared fixture failed); docs entry-points maps dist/*.d.ts back to src/*.ts for typedoc; showcase serverTime got an explicit type (TS2742: inferred type named core/dist/atom/Result, declaration:true in base tsconfig). Consumers with declaration emit may hit TS2742 on inferred Result types; a ./Result subpath or similar would fix it generically (not built, YAGNI).

Gate: pnpm turbo run test typecheck build --filter=...@sleekstack/core --force -> Tasks: 37 successful, 37 total.
pnpm install changed pnpm-lock.yaml (committed).

stage: impl-review - skipped(config: conductor requested no review)
## Evidence
- Commits: 0e52c04949a9abd9a3052acfaab4f6abf7171daf
- Tests: pnpm turbo run test typecheck build --filter=...@sleekstack/core --force
- PRs: