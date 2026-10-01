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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
