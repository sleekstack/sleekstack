---
satisfies: [R9, R10]
---
# fn-9-static-build-time-dependency-graph.6 Parity test, showcase graph and errors pages on the analyzer report, test port list

## Description
Add the parity test (for both apps/showcase-kit and the core-declared apps/showcase) (analyzer graph equals `snapshot(AppModule)` for showcase-kit), switch the showcase graph and errors pages (both showcase apps) to the analyzer's prebuilt JSON report, and commit the list of every test asserting a build-time graph error with its port target (fixture) or deliberate drop.

**Size:** M
**Files:** apps/showcase-kit/{app/graph/page.tsx,src/errors/cases.server.ts}, apps/showcase/{app/graph/page.tsx,src/errors/**}, parity test, docs/adr or .flow note for the port list
**Touches:** [apps/showcase-kit/**, apps/showcase/**, packages/analyze/src/__tests__/**]

### Approach
- Runtime-only cases (`LayerFailed`, `HandlerFailed`, `DuplicateTag`) stay as runtime demos.

### Investigation targets
**Required**:
- `apps/showcase-kit/app/graph/page.tsx:13`
- `apps/showcase-kit/src/errors/cases.server.ts:31-52`
- core / kit tests using buildGraph (scope, cycle, lifetime, privacy, graph, walk, resolve, spike; kit errors, tag, module, effect)

### Acceptance
- [ ] Parity test passes on nodes, edges, private Tags and shadowing
- [ ] Pages render from the report
- [ ] Port list committed and every build-time-error test is ported or listed as dropped

## Acceptance
- [ ] TBD

## Done summary
Parity test (apps/showcase-kit/src/__tests__/parity.test.ts) asserts the analyzer report's runtime-root graph equals snapshot(AppModule) and the Demo root equals snapshot(DemoModule) on nodes, edges, private Tags and shadowing (no mismatches found). `sleekstack check --json` now also emits each root's graph plus every root module's `graphs` and `graphErrors`; `pnpm report` (predev/prebuild) writes it to .sleekstack/report.json (gitignored), which the graph and errors pages read. Build-time gallery cases moved to top-level root modules in src/errors/graphs.ts (reported with file:line); InvalidModule/DuplicateTag/InvalidTag stay runtime. Port list at .flow/notes/fn-9-build-time-error-port-list.md; ported cases in packages/analyze fixtures/ported.

Not done: apps/showcase (core) parity and pages. It has no graph/errors pages, and its sleekstack module graph (modules.server.ts) was already deleted at HEAD (swept into c388d61) while uncommitted edits migrate it to plain Effect; core parity rests on the analyze core-app fixture vs buildGraph.
Spec drift: parity test lives in showcase-kit (it reads the report through the CLI's main), not packages/analyze (rootDir). DuplicateTag gallery case still calls snapshot; task 7 must move it to validateProvide/configureRuntime.

stage: impl-review - skipped(policy: host-deferred - conductor owns the gate)

Review: independent host review SHIP (no P0/P1). apps/showcase (core) parity/pages not done: app has no graph/errors pages at HEAD and is being migrated to plain Effect by the user. Follow-up task 7: DuplicateTag demo still uses snapshot.
## Evidence
- Commits: 61c93ee, ce8c9d4
- Tests: pnpm -r test, pnpm typecheck, pnpm --filter showcase-kit check, pnpm --filter showcase-kit build
- PRs: