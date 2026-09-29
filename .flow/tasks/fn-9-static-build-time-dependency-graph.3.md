---
satisfies: [R11]
---
# fn-9-static-build-time-dependency-graph.3 sleekstack check CLI, exit codes, prebuild and CI wiring

## Description
Expose the analyzer as `sleekstack check` (packages/cli stays a thin wrapper), with exit codes 0 / 1 / 2, `--json` to stdout only, wired as showcase-kit's Next prebuild step and a turbo / CI step ahead of tests.

**Size:** S/M
**Files:** packages/cli/{package.json,bin/*,src/check.ts}, apps/showcase-kit/package.json, turbo.json, CI config
**Touches:** [packages/cli/**, apps/showcase-kit/package.json, turbo.json, .github/**]

### Approach
- Contract: `sleekstack check [--project <tsconfig>] [--entry <file>...]`; roots = `--entry` flags, else `sleekstack.entry` in package.json, else every `configureRuntime` call outside test files; several roots validate independently; zero roots exits 2 with a usage message.
- Crash (exception) is exit 2, violations exit 1; stdout carries only JSON under `--json`, diagnostics on stderr.
- Time the showcase run; keep under 5 seconds.

### Investigation targets
**Required**:
- `packages/cli` — existing bin-only package
- `apps/docs/package.json` scripts — prebuild pattern (`generate:api`)

### Acceptance
- [ ] `sleekstack check --json` on showcase-kit prints valid JSON and exits 0
- [ ] Fixtures: zero roots (exit 2), multiple roots (each reported), test-file `configureRuntime` ignored
- [ ] A broken fixture exits 1; a crash exits 2
- [ ] Showcase prebuild and the CI step run it

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

