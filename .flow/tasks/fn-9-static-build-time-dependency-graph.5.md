---
satisfies: [R2, R3, R7]
---
# fn-9-static-build-time-dependency-graph.5 Analyzer: infer action deps from yield* and enforce the graph

## Description
Teach the analyzer to read the Tags each `defineEffect` / `defineQuery` / `effect` / `query` body yields (through helper generators), and fail when a yielded Tag is unprovided, unresolvable, private, or missing from the still-declared deps array (drift). This lands before task 4 removes the arrays, so action bodies are never unvalidated at any commit; `opts.scope` entries are read as edges once task 4 adds them.

**Size:** M
**Files:** packages/analyze/src/{actions.ts,validate.ts}, fixtures
**Touches:** [packages/analyze/**]

### Approach
- Use the checker on the generator's yield type; resolve symbol to declaration, fall back to the literal key; conditional yields over-approximate; anything unresolvable is a located error.

### Investigation targets
**Required**:
- `packages/kit/src/next/action.ts` — define* signatures
- `apps/showcase-kit/src/__tests__/graph.test.ts:19-26` — cross-check to delete

### Acceptance
- [ ] Fixtures: unprovided, private, `any`-typed and computed Tags each error with location
- [ ] showcase-kit check passes with arrays still declared; a yield outside the array errors
- [ ] Helper-generator `yield*` is followed

## Acceptance
- [ ] TBD

## Done summary
The analyzer reads the Tags each defineEffect/defineQuery/effect/query body yield*s (helper generators followed with args bound, conditionals inline or behind a const over-approximated) and reports UndeclaredDependency (drift vs the declared deps array), MissingDependency/PrivateDependency against the runtime root overlaid with opts.provide (layers and modules, whose own errors are reported), and located Unresolvable/Computed for any-typed or computed yields. Actions belong to the runtimes whose file imports them; an unreached action goes to the sole runtime, or is UnownedAction (fails the check) when several exist. Fixtures: packages/analyze/src/__tests__/fixtures/{actions,actions-roots}. showcase-kit check passes with arrays still declared. The spec's actions.ts file was not created; the logic lives in extract.ts and validate.ts.

Tier: implementer (opus, medium) per project CLAUDE.md
stage: impl-review - failed(ESCALATE same-not-fixed-lineage after 3 verdict rounds; last round's only finding (UnownedAction missing from extraction) was fixed in the final commit but not re-reviewed)

Independent-review fixes (ae92d99): non-Tag yield* operands are read through Effect R (never allowed; Context.Tag class members recorded; any/unknown/non-Effect Unresolvable), Effect.gen bodies are followed, only kit/Effect Tag shapes count as Tags; a bodiless imported action body fails in extraction.

Review: codex loop stalled; independent host review (NEEDS_WORK -> fixed in ae92d99 -> SHIP). Known limit: kit tag()/GenericTag in an Effect's R reports Unresolvable (fail closed).
## Evidence
- Commits: 72e3a4bf49097921379cfbdb8d9c143f81436fcd, f167914ef76586282e220574325999b83b2ead61, f9a56e67c0c1426e593871c69a3649dc198bce7e, 098efb4352c28c3aa895bf64403db8abb414e561, ae92d99852488735c41a7927415f57f7eb974380
- Tests: pnpm --filter @sleekstack/analyze exec vitest run, pnpm --filter sleekstack exec vitest run (packages/cli), pnpm --filter showcase-kit check, baseline: not run pre-edit
- PRs: