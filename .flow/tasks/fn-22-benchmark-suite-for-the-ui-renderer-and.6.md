---
satisfies: [R8, R10]
---
# fn-22-benchmark-suite-for-the-ui-renderer-and.6 docs: benchmarks page generated from published results

## Description
`publish-results` copies `latest.json` to `results/published.json` (the only writer) with machine info and library versions.

**Size:** M
**Files:** `apps/bench/scripts/publish-results.ts`, `apps/bench/results/published.json`, `apps/docs/app/**` and `apps/docs/lib/**` (new page and generator), `apps/docs/content/**`

### Approach
- Docs page `benchmarks` renders per-suite tables from `published.json` plus a caveats paragraph (one machine, one workload, jsdom relative only) and a link to `scenarios.ts`. Follow how existing docs pages read generated data.
- A missing `published.json` fails the docs build with a message naming `pnpm --filter bench publish-results`.
- Commit an initial `published.json` from a recorded run.

### Investigation targets
**Required**:
- `apps/docs/package.json`, `apps/docs/lib/`, `apps/docs/scripts/`, `apps/docs/test/`

### Key context
Spec `.flow/specs/fn-22-benchmark-suite-for-the-ui-renderer-and.md` is authoritative; its Architecture section defines the scenario model, result format and ratio gate.

## Acceptance
- [ ] The docs build renders the benchmarks page with tables for all four suites
- [ ] A missing `published.json` fails the build with the command named
- [ ] `pnpm --filter docs test` and typecheck pass

## Done summary
publish-results script (only writer of results/published.json, committed from one recorded run); docs generate-benchmarks.mjs renders content/docs/benchmarks.mdx (gitignored) at predev/prebuild/pretest with per-suite tables, machine info, versions, caveats, scenarios link; missing file fails naming the command; 2 docs tests.
## Evidence
- Commits: 11cedf9
- Tests: pnpm --filter docs test, pnpm --filter docs typecheck, pnpm --filter docs build
- PRs: