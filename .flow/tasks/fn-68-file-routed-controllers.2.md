---
satisfies: [R12]
---
# fn-68-file-routed-controllers.2 analyze+ui-vite: one server-only list shared by check and the plugin

Touches: [packages/analyze/src/serverServices.ts, packages/analyze/src/extract.ts, packages/analyze/src/index.ts, packages/analyze/src/errorCodes.ts, packages/analyze/src/__tests__/**, packages/ui-vite/src/server-services.ts, packages/ui-vite/src/analyze.ts, packages/ui-vite/src/index.ts, packages/ui-vite/src/__tests__/server-services.test.ts, packages/cli/llms.md]

## Description
Replace the two private copies of the server-only rule with one analyzer export (R12), and add the new Controller kinds to it. Refactor-shaped: `*.server.ts` behaviour must not change.

**Size:** S
**Files:** `packages/analyze/src/serverServices.ts`, `packages/analyze/src/extract.ts`, `packages/analyze/src/index.ts`, `packages/analyze/src/errorCodes.ts`, `packages/ui-vite/src/server-services.ts`, their tests

### Approach
- Export one list as data: kind patterns (`*.server.ts`, `*.controller.ts`) plus reserved names scoped to the server directory (`_defaults.ts` now; the sibling spec adds `rpc.ts`, `_app.ts`), and one broadened test-file predicate (`__tests__/`, `test/`, `tests/`, `*.test.*`, `*.spec.*`). Today these are `SERVER_FILE` at `analyze/serverServices.ts:22` and `ui-vite/server-services.ts:28`, and `TEST_FILE` at `analyze/extract.ts:63` and `ui-vite/server-services.ts:30`.
- Have the plugin read the list through its existing jiti route to the analyzer (`server-services.ts:153-168`), and delete its copies. The load guard (`:260-277`) uses the list; the watch predicate stays separate (it watches contract sources, not server-only files). <!-- Updated by plan-sync: fn-68-file-routed-controllers.1 added lines to server-services.ts, so the line references moved -->
- Add the `serverDir` plugin option (default `server`) used to scope the reserved names. It must reach every consumer in `sleekstack()`: the bundled `analyze()` plugin (`ui-vite/src/analyze.ts`) takes the directory and passes it to `analyzeServerServices({ project, serverDir })`, and `index.ts` hands it `options.serverDir`. Test `sleekstack({ serverDir: 'lib' })`: it allows `server/_defaults.ts` and rejects `lib/_defaults.ts`. <!-- Added after impl-review round 1 of this task (SCOPE_EXCEEDED): Touches widened to analyze.ts, index.ts and llms.md (the rule-text change regenerates it) -->
- `sleekstack check` cannot see a Vite option, so it reads the default `server` directory; a custom `serverDir` is a Vite-only option and the docs (task 12) say so. No CLI flag.
- Update the `ServerFileInClientGraph` rule text (`errorCodes.ts:166`).
- Equivalence pin: the existing boundary tests in analyze and ui-vite, the `server-boundary` check fixture, and the showcase and realworld client-chunk tests pass unchanged.

### Investigation targets
**Required** (read before coding):
- `packages/analyze/src/serverServices.ts:21-22,277-337` - list, valueImports, graph walk
- `packages/ui-vite/src/server-services.ts:28-30,153-168,260-277` - copies, jiti route, load guard
- `packages/analyze/src/errorCodes.ts:160-170`

**Optional**:
- `packages/cli/src/__tests__/check.test.ts` - boundary fixtures

## Acceptance
- [ ] one exported list; no private `SERVER_FILE` or `TEST_FILE` left in ui-vite
- [ ] a `*.controller.ts` reachable from a browser entry fails the client build and is reported as `ServerFileInClientGraph`
- [ ] a `_defaults.ts` outside the server directory is not flagged
- [ ] a test-only file under `test/` is excluded like one under `__tests__/`
- [ ] existing boundary tests pass unchanged
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/ui-vite...` passes

## Done summary
BLOCKED (SCOPE_EXCEEDED) after the first review round. The code is committed and every gate is green. The single surviving review finding can only be fixed outside the declared Touches.

Implemented: `@sleekstack/analyze` now exports one server-only list, `SERVER_ONLY` (kinds `server` and `controller`, plus the reserved name `_defaults`, which counts only under the server directory). It also exports the predicate `isServerOnly(file, serverDir)` and `TEST_FILE`, broadened to cover `__tests__/`, `test/`, `tests/`, `*.test.*` and `*.spec.*`. `analyzeServerServices` takes `serverDir` (default `server`), and its client-graph walk and contract-file checks use the shared predicate. `serverServices()` reads the list through its jiti route, has dropped its private `SERVER_FILE` and `TEST_FILE`, and gains the `serverDir` option. The load filter now matches every source, because the list is read at run time. The watcher keeps its own `IMPLEMENTATION` pattern, as the plan said. The `ServerFileInClientGraph` rule text names the new kinds.

One file outside Touches was regenerated: `packages/cli/llms.md`, via `UPDATE_LLMS=1 vitest run llms`. The rule-text change made its generated error section stale, which would have failed the `sleekstack` test gate. Tasks 4 and 12 list it in their Touches.

Tests (each run red before the fix, for the intended reason):
- analyze `serverServices.test.ts`: the `server-boundary-kinds` fixture, run with the default `serverDir` and with `lib`. A Controller is reported. A `_defaults.ts` is reported only under the server directory. `test/entry.ts` is not a browser entry.
- ui-vite `server-services.test.ts`: a Controller fails the client build naming the chain. `_defaults.ts` fails the dev client load only under `serverDir`, checked with the default and with `lib`. A test-only file under `test/` may import a server file.

Surviving finding (codex round 1, NEEDS_WORK; the contracts and integration draws found the same defect; correctness gave SHIP): `sleekstack({ serverDir })` passes the option to `serverServices()` only. The bundled `analyze()` plugin (`packages/ui-vite/src/analyze.ts`, `sleekstackAnalyzer`) still calls `analyzeServerServices({ project })` with the default `server`, so a custom `serverDir` gets a false `ServerFileInClientGraph` for `server/**/_defaults.ts` from the analyze plugin. Proposed fix (about 5 lines, outside Touches): let `analyze()` take the server directory and pass it to `analyzeServerServices({ project, serverDir })`, and have `index.ts` call it with `options.serverDir`. Add a `sleekstack({ serverDir: 'lib' })` test that allows `server/_defaults.ts` and rejects `lib/_defaults.ts`. A related gap that is not a review finding: the `sleekstack check` CLI cannot see a Vite option, so a custom `serverDir` is invisible to it. That is spec-level.

Pre-existing flake (not caused by this task): on one cold run, before the plugin change, the existing test "fails the client build naming the import chain" got a chain without `index.html ->`. It passed 6 reruns. It looks like a race in when Rolldown fires `moduleParsed` for `index.html`.

Gates: baseline green via receipt 1fa0aad3. After the change, the spec's full test and typecheck command passed (28 tasks; analyze 100, cli 27, ui-vite 182 and realworld 155 tests all ran with no cache hit). showcase and docs tests and typechecks are green. `pnpm --filter realworld check` is green. The fixture graph check diff is empty.
GATE_SKIPPED:unittest:green-receipt 1fa0aad3 - baseline reused from prior post-gate pass

Tier: session (jev-unavailable(no_key)); routing block sets opus at medium (actual: claude-opus-5-5)

stage: impl-review - failed(round 1 NEEDS_WORK; the fix is outside the declared Touches; escalated SCOPE_EXCEEDED, not re-reviewed)

---

Round 2 (continuation, after the conductor widened Touches in fdac3756): the surviving finding is fixed in 1cdd61aa, the codex re-review returned SHIP, and the task is done. The BLOCKED status above is resolved.

Fix: `analyze(run, serverDir?)` in `packages/ui-vite/src/analyze.ts` passes the directory to `analyzeServerServices({ project, serverDir })`. The `Analyzer` type takes `serverDir` as its second argument, and the default stays the analyzer's `server`. `sleekstack()` in `packages/ui-vite/src/index.ts` calls `analyze(undefined, options.serverDir)`, so both bundled plugins now read the same server directory. `packages/cli/llms.md` was already regenerated in round 1 and needed no change in this round.

Tests (both ran red first, each for the intended reason): `server-services.test.ts`, under "sleekstack({ serverDir: "lib" }), its analyzer included". A client build reaching `server/_defaults.ts` passes; before the fix it failed with the analyzer's false `ServerFileInClientGraph`. A client build reaching `lib/_defaults.ts` fails with the analyzer's `ServerFileInClientGraph: The server-only "lib/_defaults.ts"`; before the fix, only the load guard rejected it.

Still a gap and not a finding: `sleekstack check` cannot see a Vite option, so it always reads `server`. The spec assigns that to the docs in task 12.

Gates (re-verified in this round, not taken from round 1). Baseline: green through a turbo cache hit on the Quick command (28 of 28 tasks cached), and `pnpm --filter realworld check` green. After the fix, the spec's full test and typecheck command passed: 28 tasks, 5 run uncached, including ui-vite (184 tests, the 182 from round 1 plus 2 new) and realworld (155 tests). Green receipt `.flow/tmp/green-receipts/1cdd61aa-unittest.json`. `pnpm --filter realworld check` and the showcase and docs test and typecheck runs are green. The round-1 flake ("fails the client build naming the import chain") did not reappear.

Memory: bug/integration entry `sleekstack-option-must-reach-every-2026-10-22`.

stage: impl-review - ran (round 1 NEEDS_WORK, 1 finding; round 2 codex re-review SHIP on 5b98abe1..1cdd61aa)
stage: plan-sync - ran (sonnet; updated tasks 3, 4, 7, 8, 12)
## Evidence
- Commits: a1058bde1177879b73bed2c6c918e3b0aadc24c3, fdac37560ec50717472c48b5040b2025725a65ed, 1cdd61aa1dc2df7c26fecb43b32ab9053ff62a69
- Tests: GATE_SKIPPED:unittest:green-receipt 1fa0aad3 - baseline reused from prior post-gate pass, pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=realworld, pnpm turbo run test typecheck --filter=showcase --filter=docs, pnpm --filter realworld check, (cd packages/cli/src/__tests__/fixtures/effect-app && node ../../../../bin/cli.js check --json --entry runtime.ts) # diff before/after empty, pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=realworld # round 2, after 1cdd61aa, pnpm --filter realworld check # round 2, pnpm turbo run test typecheck --filter=showcase --filter=docs # round 2
- PRs: