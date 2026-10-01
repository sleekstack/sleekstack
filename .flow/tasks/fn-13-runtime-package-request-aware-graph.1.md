---
satisfies: [R1]
---
# fn-13-runtime-package-request-aware-graph.1 Extract the runtime into @sleekstack/runtime

Touches: packages/runtime/**, packages/next/src/**, packages/kit/src/next/**, .github/workflows/ci.yml, apps/*/next.config.*, apps/docs/**/entry-points.mjs, packages/analyze/src/extract.ts

## Description
**Touches:** packages/runtime, packages/next/src, packages/kit/src/next, CI list, transpilePackages in playground/showcase/next apps, docs entry-points PACKAGES, packages/analyze/src/extract.ts (libId + RUNTIME_CALLS one-liner)

**Files:** new packages/runtime (src, package.json, tsconfig, vitest config), packages/next/src/runtime.ts and devtools.ts, packages/next/src/index.ts, packages/kit/src/next/{runtime,action}.ts

Move configureRuntime/runEffect/getRuntime, ErrorSink/ErrorInfo, the slot and the DevEvent buffer (devEvents, devLive, devEnabled) into the new package. Add `isControlFlow` to RuntimeConfig, stored in the slot with the first config for an id, default never-control-flow. Keep the slot key `'@sleekstack/next/runtime-slot/v3'`; new slot fields are optional and read defensively. `@sleekstack/next` re-exports the generic names (configureRuntime, runEffect, getRuntime, RuntimeNotConfigured, ErrorInfo/ErrorSink/RunEffectOptions/RuntimeConfig, reportFinalizerFailure) and keeps `isNextControlFlow` as a Next-only export: the runtime package exports the generic APIs plus the classifier contract type only. Next's `runEffect` re-export is a thin wrapper that passes `isNextControlFlow` as a per-call classifier default, so an old-shaped slot that won the first-config race still gets Next control-flow behavior; the devtools handler stays in next and reads the buffer from runtime. Kit's runtime imports the runtime package; `kit/next/action.ts` keeps importing `isNextControlFlow` from next.

Wire the package: CI script list, transpilePackages x3, docs PACKAGES, api-coverage test, tsconfig paths. Update analyzer `libId` regex and RUNTIME_CALLS so `runtime/runtime#configureRuntime` is still a root (otherwise the check silently shows no roots).

Pattern: follow packages/devtools for a small package layout. Do not commit emitted .js/.d.ts files.

## Acceptance
- [ ] All existing next, kit and showcase tests pass importing from the new package
- [ ] Mixed-copy test: a slot created under the old key by an old-shaped config (no classifier) is usable, and a Next redirect through next's `runEffect` is rethrown untouched, not reported or wrapped
- [ ] Test that a supplied non-Next classifier decides control flow and Next digests are ignored outside the Next preset
- [ ] `pnpm typecheck && pnpm test` and docs api-coverage pass; analyzer still finds the showcase configureRuntime root

## Done summary
Extracted the runtime (configureRuntime/runEffect/getRuntime, error sink, slot, devtools buffer) into framework-agnostic @sleekstack/runtime with an `isControlFlow` config classifier (default never; per-call fallback); @sleekstack/next re-exports it, keeps isNextControlFlow, and its runEffect falls back to the Next classifier so old-shaped slots keep Next behavior. Devtools buffer lives at the `@sleekstack/runtime/internal` subpath (excluded from docs entry points). Wired CI, transpilePackages x3, docs PACKAGES, analyzer libId/RUNTIME_CALLS (showcase root still found). Tests: packages/runtime/src/__tests__/classifier.test.ts, packages/next/src/__tests__/mixed-copy.test.ts.

baseline: red (pnpm test: showcase-kit bundle.test.ts Island marker, 2 tests, pre-existing; unchanged after)
Tier: implementer tier, project routing block (opus at medium)

stage: impl-review - ran (codex fan-out NEEDS_WORK -> 2 re-reviews -> SHIP)
## Evidence
- Commits: 38c025e89e6d1333a7296b4b7a89501594e9bc5c, bfb40175fc38fc8fe087c270aa0ad3d8fbb70251, 0a8cb3900c882c3373f37c82d0ddfa1e3af880e7
- Tests: pnpm typecheck && pnpm test (red only on inherited showcase-kit bundle test), pnpm --filter showcase build && pnpm --filter showcase test, pnpm --filter docs test
- PRs: