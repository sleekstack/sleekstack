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
Added `sleekstack check [--project] [--entry...] [--json]` (packages/cli/src/check.ts; bin dispatches `check` through jiti and keeps help/version), with exit 0 clean / 1 violations / 2 crash, usage, or zero roots, and JSON-only stdout under --json. The analyzer gained root discovery: each `configureRuntime` call (kit or next) is a synthetic root, validated on its own; `analyze({ entries })` limits roots to given files, test files are skipped otherwise. Unreadable-declaration errors are now owned by their module and count only for roots that reach them; `Report.extraction` holds the unowned ones, `Report.runtimes` the per-root results. This was needed because showcase-kit's deliberately broken error gallery is not reachable from its runtime.

Wiring: showcase-kit devDepends on `sleekstack` (workspace), `check` script + `prebuild`; CI step "Dependency graph check" runs before Test. turbo.json unchanged (the CI step uses pnpm --filter; no turbo task needed). pnpm-lock.yaml changed for the new deps (outside declared Touches, required).
Showcase run: 1.5-1.7s wall (limit 5s).
Tests: packages/cli/src/__tests__/check.test.ts (multi roots + test-file ignored + exit 1, --entry, package.json sleekstack.entry, zero roots exit 2, crash exit 2, showcase-kit JSON exit 0, bin help/version).
Note: full `pnpm test` shows an inherited apps/showcase failure (requests.test.ts demo-mode shadow); showcase is untouched by this task, likely stray emitted .js siblings there.
Tier: implementer (opus, medium) per project CLAUDE.md

stage: impl-review - ran (codex fan-out NEEDS_WORK -> fix -> re-review SHIP)
## Evidence
- Commits: 07331cc3291d4da7fc69b5a369bc9aa534582e63, 36219bc8ef051abe2434da0acfdfdacdf10004be
- Tests: cd packages/cli && npx vitest run && npx tsc --noEmit, cd packages/analyze && npx vitest run && npx tsc --noEmit, cd apps/showcase-kit && npx tsc --noEmit && pnpm check
- PRs: