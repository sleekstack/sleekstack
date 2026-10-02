---
satisfies: [R2]
---
# fn-13-runtime-package-request-aware-graph.2 Analyzer request/overrides roots, Report kind, --lenient

Touches: packages/analyze/src/**, packages/cli/src/check.ts, packages/analyze/**/__tests__/**

## Description
**Touches:** packages/analyze/src (extract.ts, model.ts, validate.ts), packages/cli/src/check.ts, their tests

**Files:** packages/analyze/src/extract.ts, model.ts, validate.ts; packages/cli/src/check.ts

Add a RUNTIME_RUN_CALLS set (runtime and next declaring paths for runEffect, resolved through libId so aliased imports work). Keep the new logic in its own module (e.g. packages/analyze/src/runtimeRoots.ts) called from extract(), not inlined in the already-large extract function. Each call with a `request` or `overrides` option becomes a root with `kind`, validated against own provides plus any app root's provides (see Planning decisions). No options means no root. Each Layer-valued branch of a conditional is a root; nullish branches (`undefined`/`null`) are skipped, not roots; spread/variable/parameter options fail closed with their own error code. Kit action bodies (no `request`) yield no root. A request layer shadowing an app Tag follows the existing shadowing model.

Report gains additive `kind: 'app'|'request'|'overrides'|'opaque'`; app roots stay first in `roots`. CLI: `--lenient` downgrades unresolvable layers (only) to an opaque node with file:line, exit 0, `ok` true; summary line prints kind. Test files are ignored. Beware serialising with fn-12 task 8, which edits extract.ts and model.ts.

## Acceptance
- [ ] Request layer requiring an app singleton passes; requiring a Tag nobody provides fails with file:line at the call
- [ ] `cond ? LayerA : LayerB` yields two overrides roots; `cond ? DemoLive : undefined` yields one; non-literal options fail closed
- [ ] Showcase yields exactly one request root (RequestLive) and one overrides root (DemoLive)
- [ ] Unresolvable layer fails by default and becomes an opaque node under --lenient (exit 0, JSON has kind and file:line)
- [ ] Showcase check output includes RequestLive and DemoLive roots

## Done summary
Every Layer-valued branch of a `runEffect({ request, overrides })` option (runtime and next `runEffect`, matched through libId) is now its own root, built in packages/analyze/src/runtimeRoots.ts. A root passes if its own provides plus any configureRuntime app root satisfy its requirements. A request layer shadows app Tags under the existing shadowing model. Nullish branches are skipped, and spread, variable or computed options fail closed as `NonLiteralOptions` in extraction. `Report.runtimes` gains `kind` ('app' | 'request' | 'overrides' | 'opaque') with app roots first. `sleekstack check --lenient` turns an unresolvable runEffect layer into an opaque root (exit 0, `ok` true, JSON has kind plus file:line), and the summary line prints `[kind]`.

Tests: packages/analyze/src/__tests__/fixtures.test.ts ("runEffect request/overrides layers are roots...", fixture request-roots: app singleton passes; MissingDependency at the call line; `cond ? A : B` gives 2 roots; `cond ? A : undefined` gives 1; NonLiteralOptions for a variable and for a spread; Computed by default and opaque under lenient). packages/cli/src/__tests__/check.test.ts covers the showcase (exactly one [request] RequestLive and one [overrides] DemoLive, exit 0), showcase-kit (app roots only, so kit actions add no root), and the lenient fixture (exit 1 by default, 0 under --lenient).

Notes:
- `--lenient` applies only to runEffect request/overrides layers. An unresolvable `configureRuntime({ layer })` still fails, because the AC names only the request/overrides path.
- MissingDependency errors for a request root are located at the runEffect call (the leaf loc is rewritten to the call site), as the AC requires.
- Request-layer leaves get lifetime 'request'. Overrides leaves keep their typed lifetime ('app').
- Each root's graph includes the app graph it was checked over, so edges into the app appear.
- Worktree was created from master (60002ea), not 9959d58. It was reset to 9959d58 before any work.

baseline: green (analyze + cli focused tests pre-edit; full suite also green post-edit)
Tier: implementer tier, project routing block (opus at medium)

stage: impl-review - skipped(policy: parallel-wave - conductor owns the gate)

stage: impl-review - ran (codex fan-out NEEDS_WORK -> re-review -> SHIP)
stage: plan-sync - skipped(empty: conductor edited downstream task notes directly)
## Evidence
- Commits: c7d39e3, 37bd030
- Tests: pnpm typecheck && pnpm test, pnpm --filter showcase build && pnpm --filter showcase test, pnpm -C packages/cli test, pnpm -C packages/analyze test
- PRs: