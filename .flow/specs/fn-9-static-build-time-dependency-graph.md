## Goal & Context
<!-- scope: business -->

Today the dependency graph is validated at runtime: `buildGraph` (packages/core/src/graph.ts) rejects missing, cyclic, captive, ambiguous and private-Tag dependencies, and `snapshot` exposes it to tests. A Server Action's deps are a hand-written array (`defineEffect(gen, [Tags])`) that a graph test cross-checks against `snapshot(AppModule)`. Three problems: (1) validation only runs when app code is imported and executed (`server-only`, Next stubs, test setup); (2) the declared array and the generator body can drift; (3) a second, separate graph (`snapshot`) exists purely for checking.

Goal: one static analyzer is the only place the graph is validated. It reads the same `layer()` / `module()` / `defineEffect()` / `defineQuery()` declarations the runtime uses, builds the full graph at build time, and fails the build on any violation. No `snapshot`, no runtime validation graph. Action/query deps are inferred from what the generator body `yield*`s, so the array disappears.

Supersedes ADR 0004 (hybrid service definitions: metadata now read statically), ADR 0005 (dependency arrays), and the runtime-enforcement half of ADR 0006 (privacy is checked statically; the runtime keeps its filtered public Context so misses still explain themselves).

## Architecture & Data Models
<!-- scope: technical -->

- **Analyzer** (new package `@sleekstack/analyze`): TypeScript compiler API. Inputs: tsconfig + entry roots. Entry resolution: each `--entry` flag, else `sleekstack.entry` in the nearest package.json, else every `configureRuntime` call outside test files; zero roots is a usage error (exit 2), several roots are each validated as a separate graph. Declarations understood: kit `tag` / `layer` / `module` / atoms / kit `effect`, and core `Context.Tag` / `Context.GenericTag` / `service` / `declareLayer` / core `module` (apps/showcase is core-based). Outputs: a graph JSON (`nodes`, `edges`, `modules`, `private`, `shadowing`, `actions`) and errors with file:line.
- **Tag identity**: `tag<T, const K extends string>(name: K)` so the key is a literal in the type; a yielded `Tag<T, 'TaskRepo'>` identifies itself. Fallback: resolve the `yield*` operand to its `tag('Name')` declaration through the checker.
- **Action deps**: the union of yielded Tag types in the generator's `Generator<Y, R>` (this also follows `yield*` through helper generators). `defineEffect` / `defineQuery` drop the deps array parameter; `.deps` is removed.
- **Lazy layer state machine** (in its own module, not inside `open`): each provider is unbuilt, building (one shared in-flight promise, so concurrent waiters share one build), built (memoized per scope) or failed. Re-entrancy is detected by the resolving chain, not a global flag, and raises `DependencyCycle`. A failed build is not memoized (a later resolve retries) and clears its marker; finalizers register once, on success only, and run in reverse build order.
- **Generator layers**: `layer(Tag, function* () { const store = yield* Store; return impl }, opts?)` accepts a generator factory and infers its requirements from the yielded Tags, exactly like `defineEffect`; the `layer(tag, impl, [deps])` array form keeps working. Because requirements are no longer declared up front, the runtime resolves such layers lazily on first `yield*` and memoizes the result (a layer's finalizers still run in reverse build order); cycles and captive lifetimes are caught by the analyzer, and a runtime re-entrant build fails with `DependencyCycle` as a backstop.
- **Side-effect scopes**: a dep that is never yielded (today `RequestContext`, kept only so its request-scoped layer runs) is declared explicitly: `opts.scope: [RequestContext]`. Analyzer treats it as an edge.
- **Types, not syntax**: the analyzer reads the checker's resolved types for `layer()` / `module()` / `provide` / `imports`, so loops, conditionals and computed lists work: an array typed `(Layer<A> | Layer<B>)[]` contributes every member it may contain. Results over-approximate (a maybe-provided Tag counts as provided for the missing check; a maybe-present edge counts for cycle and captive checks). Only a type that is not precise enough (`any`, a widened `Layer<any>[]`, a Tag with a non-literal key) is a build error, so the escape hatch is to fix the type, not an opt-out.
- **Two runtime paths, split explicitly**: the *root plan* (`buildPlan`, app / provider entries vetted by the analyzer) does module traversal, winner selection for shadowing and ordering without throwing for missing, private, captive, cycle or ambiguity; the *dynamic boundary* path (per-call `provide`, child scopes, `LayerProvider` entries) keeps the validating `resolveEntries` / `toposort` and throws `DuplicateTag`, `AmbiguousProvider`, `DependencyCycle`, and its resolves still throw `MissingDependency` / `PrivateDependency`. Shared traversal code is one module used by both.
- **Runtime keeps a resolution plan, not a validated graph**: `makeAppScope`, child scopes, shadowing, `toposort` and the privacy Context in packages/core/src/scope.ts currently consume `Graph`. That structure stays as an internal *resolution plan* (`resolveEntries` + `toposort`) so scopes can still build services in order and shadow per call. It no longer runs validation (`checkLifetimes`, cycle, ambiguity, privacy-at-build) and is not exported as `snapshot`.
- **Lazy request resolution**: `runGen` (packages/kit/src/next/action.ts) resolves each yielded Tag from the request scope on demand instead of pre-resolving an array. Undeclared-Tag isolation (today's `Effect.mapInputContext` over declared deps only) is preserved by the analyzer: a Tag outside the statically known graph fails the build.

## API Contracts
<!-- scope: technical -->

- `defineEffect(gen, opts?)`, `defineQuery(gen, opts?)`, `effect(gen, opts?)`, `query(gen, opts?)` — deps parameter removed; `opts: { provide?, scope? }`.
- `tag<T, K extends string>(name: K)`.
- New CLI / API: `sleekstack check` (or `analyze({ project, entry })`) returning `{ graph, errors }`; exit code non-zero on errors; wired to a Next prebuild step and to `vitest` via a helper.
- Removed: `snapshot`, `Graph` / `GraphSnapshot` public types, `.deps`, kit `buildGraph` re-exports.
- Runtime errors that remain: `MissingDependency` / `PrivateDependency` on resolve (defense in depth for what static analysis was told to trust), `LayerFailed`, `HandlerFailed`, `DuplicateTag` for `provide` arrays built per call.

## Edge Cases & Constraints
<!-- scope: technical -->

- Per-call `opts.provide` (including the demo-mode thunk) shadows at runtime; the analyzer validates the shadowing Layers' own deps but cannot know a thunk's result. Constraint: thunks must return a statically typed union of Layers, otherwise flagged.
- Conditional / computed `provide` lists are accepted when their type is precise (see Types, not syntax); over-approximation can hide a missing dependency that only occurs in one branch, which is the accepted cost.
- Tags referenced through re-exports, barrel files and `as const` records must resolve through the checker.
- Monorepo: the analyzer must follow workspace package imports (the showcase imports `@sleekstack/kit`), and ignore generated `.js` / `.d.ts` files next to sources (the IDE emit problem seen in this repo).
- Atoms (`atom(fn, [deps])`) keep their deps array (inference for them is a follow-up), but the analyzer reads those arrays as edges so atom nodes stay in the graph.
- A yielded Tag that cannot be resolved to a declaration (typed `any`, a non-literal key, a Tag computed at runtime) is an R7 build error. `yield*` inside a conditional over-approximates the deps, which is accepted as safe. Abstract-class Tags resolve by class declaration. Tags inside `as const` records resolve through the checker.
- `LayerProvider` in React builds entries from props at runtime: the analyzer checks `module()` / `layer()` graphs only, and `LayerProvider` keeps `MissingDependency` at resolve time as its backstop (documented).
- `tag<T, const K>(name)` breaks partial type-argument inference (`tag<T>('x')` would default K to `string`); the signature must keep `tag<T>('x')` working, with the literal key recovered from the call expression by the analyzer rather than a second type parameter if an overload cannot preserve it.
- Existing kit `effect(fn, deps, opts)` in kit core (graph node `effect:<name>`) is a different thing from the Next `effect`; both are read by the analyzer.
- `packages/next` and `packages/react` also consume core's graph; both must keep working against the resolution plan.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `sleekstack check` on apps/showcase-kit and on the core-declared apps/showcase builds the full graph without importing or executing any app module, and fails with file:line on each of: missing dependency, cycle, captive lifetime, ambiguous provider, private-Tag use.
- **R2:** `defineEffect` / `defineQuery` / `effect` / `query` take no deps array; the analyzer derives deps from `yield*` including through helper generators.
- **R3:** A body that yields a Tag no layer provides fails the check; the showcase's `boardActionDeps` array and `graph.test.ts` cross-check are deleted.
- **R4:** `snapshot` and the public `Graph` types are removed. `buildGraph`'s whole-graph validation (missing/private loop, `checkLifetimes`, build-time cycle and ambiguity checks) is deleted; core keeps an internal, non-exported `ResolutionPlan` (`buildPlan(entries)`, no validation) that `packages/next`, `packages/react` and kit's module code consume. Runtime `provide` and child-scope boundaries (the dynamic-boundary path) keep their throwing paths for `DuplicateTag`, `DependencyCycle` and `AmbiguousProvider`, because per-call entries cannot be seen statically. The root plan must not validate; the dynamic-boundary path must. Errors: a caller of a removed export fails to typecheck.
- **R5:** Side-effect scopes (`RequestContext`) are declared via `opts.scope` and appear as edges in the static graph.
- **R6:** Existing runtime behavior is unchanged: request scopes, finalizer order, shadowing via `provide`, private Tags hidden from public Context, error codes and messages. All existing kit / next / react / showcase tests pass or are ported.
- **R7:** The analyzer evaluates declaration expressions (loops, conditionals, array methods, local helpers) over precisely typed sources and over-approximates the result; any declaration it cannot read (`any`, widened arrays, non-literal keys, unreadable bodies) is a located build error naming the expression. There is no opt-out (fail closed). Errors: each unreadable expression reports file:line.
- **R8:** ADRs 0004, 0005, 0006 are superseded by one new ADR that states why 0005's rejection of a compiler plugin no longer holds (the analyzer is a checker CLI, not a bundler transform, so runtime code needs no plugin) and records the lock-in (dropping the array makes the analyzer mandatory); CONTEXT.md, docs guides, snippets, READMEs and the API reference are updated; kit's public d.ts still never references `effect` or `@sleekstack/(core|next|react)` (R7 dts test).

- **R9:** No commit leaves a Server Action or layer body without build-time validation of its yielded Tags: the analyzer's inference (checking yields against the still-declared arrays) lands before the arrays are removed. Before `snapshot` is deleted, a parity test asserts the analyzer's graph for apps/showcase-kit equals `snapshot(AppModule)` (nodes, edges, private Tags, shadowing); until then both validators run, so no commit leaves the graph unguarded. Errors: any mismatch fails the test naming the differing node or edge.
- **R10:** Each error the showcase errors page demonstrates (`MissingDependency`, `DependencyCycle`, `CaptiveDependency`, `AmbiguousProvider`, `ModuleCycle`, `DuplicateModule`, `PrivateDependency`) has an analyzer fixture (a tiny tsconfig project) asserting the error code and file:line; the runtime-only cases (`LayerFailed`, `HandlerFailed`, `DuplicateTag`) stay as runtime tests. Every test that asserted a build-time graph error is ported or deliberately dropped in a list committed with the change. The showcase graph and errors pages render the analyzer's prebuilt JSON report.
- **R11:** `sleekstack check [--project <tsconfig>] [--entry <file>...]` resolves roots as described in Architecture and exits 0 (ok), 1 (violations) or 2 (analyzer crash); `--json` writes only JSON to stdout; it runs as a Next `prebuild` step in showcase-kit and as a CI step before the tests, in under 5 seconds for the showcase. It resolves sources through the tsconfig project only and fails when a module resolves to an emitted `.js` / `.d.ts` sibling of a `.ts` file.
- **R12:** `layer()` accepts a generator factory whose `yield*`ed Tags become its requirements, both at runtime (lazy, memoized resolution honoring lifetimes and finalizer order) and in the analyzer (edges, missing, captive, cycle checks); the array form is unchanged. Errors: yielding an unprovided Tag fails with `MissingDependency` at resolve time and as an analyzer error; a runtime re-entrant build fails with `DependencyCycle`; an `app`-lifetime layer yielding a `request` Tag is a captive error.

## Quick commands

```bash
pnpm --filter @sleekstack/analyze test && pnpm --filter showcase-kit exec sleekstack check --json
pnpm -r test
```

## Early proof point

Task fn-9-static-build-time-dependency-graph.1 validates the core approach (the compiler API can extract Tags, layers and modules from a real tsconfig project without executing it). If it fails, re-evaluate the fully-static choice before continuing with fn-9-static-build-time-dependency-graph.2+; the fallback is the manifest-only analyzer with `snapshot` kept as validator.

## Boundaries
<!-- scope: business -->

In: static analyzer, deps inference, removal of `snapshot` / runtime validation, kit + core + next + showcase-kit migration, docs / ADR.
Out: atoms deps inference, React `useService` typing changes, a graph visualization UI (the JSON output enables it later), the pre-existing failing demo-mode test, IDE-emitted artifact cleanup beyond ignoring them in the analyzer.

## Ordering

Stages 1 and 2 land with dual validation (analyzer plus the existing runtime `buildGraph`), the R9 parity test gates stage 3, and stage 3 migrates `packages/next`, `packages/react` and kit's module code to `ResolutionPlan` in one task. fn-9 lands after the fn-8 branch merges (both rewrite kit's `next/action.ts` and `tag.ts`); it changes fn-5's `effect(fn, deps, opts)` surface and drops the snapshot references in fn-1 / fn-3.

## Decision Context
<!-- scope: both -->

- Chosen: fully static graph as sole validator, per the user's direction that no separate runtime graph should exist to drift.
- Rejected: manifest-only analyzer (needs `snapshot` as validator, keeps two graphs); lazy resolution with no analyzer (loses undeclared-Tag isolation and the pre-flight guarantee); type-level-only inference (erased at runtime, no list for tests).
- Risk: the analyzer cannot see arbitrary dynamic composition; mitigated by failing closed. A thin runtime resolution plan is unavoidable because scopes still need construction order and shadowing. Sizing is large (core + kit + next + react + analyzer); plan in stages: (1) literal-key Tags + analyzer reading current graph, (2) deps inference + `opts.scope`, (3) remove `snapshot` / runtime validation, (4) docs / ADR.
- Decided: the analyzer lives in a new `@sleekstack/analyze` package using the raw TypeScript API (typescript as a peer dependency, no ts-morph), with `packages/cli` as a thin `sleekstack check` wrapper; there is no `dynamic()` opt-out (types replace it); `opts.scope` ships on day one for `RequestContext`; per-call `provide` thunks keep runtime validation.
- Maintainability (plan review): duplication - module traversal / shadowing / ordering exist in the analyzer and the retained core plan; keep the semantics pinned by the parity test. structure - lazy layer state lives in its own module rather than growing `scope.ts`'s `open`.
- Rejected as overkill: a `dynamic()` opt-out; a fully static React `LayerProvider` analysis.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | `sleekstack check` on apps/showcase-kit and on the core-declared apps/showcase builds the full graph without importing or executing any app module, and fails with file:line on each of: missing dependency, cycle, captive lifetime, ambiguous provider, private-Tag use. | fn-9-static-build-time-dependency-graph.1, fn-9-static-build-time-dependency-graph.2 | — |
| R2 | `defineEffect` / `defineQuery` / `effect` / `query` take no deps array; the analyzer derives deps from `yield*` including through helper generators. | fn-9-static-build-time-dependency-graph.4, fn-9-static-build-time-dependency-graph.5 | — |
| R3 | A body that yields a Tag no layer provides fails the check; the showcase's `boardActionDeps` array and `graph.test.ts` cross-check are deleted. | fn-9-static-build-time-dependency-graph.5 | — |
| R4 | `snapshot` and the public `Graph` types are removed. `buildGraph`'s whole-graph validation (missing/private loop, `checkLifetimes`, build-time cycle and ambiguity checks) is deleted; core keeps an internal, non-exported `ResolutionPlan` (`buildPlan(entries)`, no validation) that `packages/next`, `packages/react` and kit's module code consume. Runtime `provide` and child-scope boundaries (the dynamic-boundary path) keep their throwing paths for `DuplicateTag`, `DependencyCycle` and `AmbiguousProvider`, because per-call entries cannot be seen statically. The root plan must not validate; the dynamic-boundary path must. Errors: a caller of a removed export fails to typecheck. | fn-9-static-build-time-dependency-graph.7 | — |
| R5 | Side-effect scopes (`RequestContext`) are declared via `opts.scope` and appear as edges in the static graph. | fn-9-static-build-time-dependency-graph.4 | — |
| R6 | Existing runtime behavior is unchanged: request scopes, finalizer order, shadowing via `provide`, private Tags hidden from public Context, error codes and messages. All existing kit / next / react / showcase tests pass or are ported. | fn-9-static-build-time-dependency-graph.4, fn-9-static-build-time-dependency-graph.7 | — |
| R7 | The analyzer evaluates declaration expressions (loops, conditionals, array methods, local helpers) over precisely typed sources and over-approximates the result; any declaration it cannot read (`any`, widened arrays, non-literal keys, unreadable bodies) is a located build error naming the expression. There is no opt-out (fail closed). Errors: each unreadable expression reports file:line. | fn-9-static-build-time-dependency-graph.1, fn-9-static-build-time-dependency-graph.5 | — |
| R8 | ADRs 0004, 0005, 0006 are superseded by one new ADR that states why 0005's rejection of a compiler plugin no longer holds (the analyzer is a checker CLI, not a bundler transform, so runtime code needs no plugin) and records the lock-in (dropping the array makes the analyzer mandatory); CONTEXT.md, docs guides, snippets, READMEs and the API reference are updated; kit's public d.ts still never references `effect` or `@sleekstack/(core\|next\|react)` (R7 dts test). | fn-9-static-build-time-dependency-graph.8 | — |
| R9 | No commit leaves a Server Action or layer body without build-time validation of its yielded Tags: the analyzer's inference (checking yields against the still-declared arrays) lands before the arrays are removed. Before `snapshot` is deleted, a parity test asserts the analyzer's graph for apps/showcase-kit equals `snapshot(AppModule)` (nodes, edges, private Tags, shadowing); until then both validators run, so no commit leaves the graph unguarded. Errors: any mismatch fails the test naming the differing node or edge. | fn-9-static-build-time-dependency-graph.6 | — |
| R10 | Each error the showcase errors page demonstrates (`MissingDependency`, `DependencyCycle`, `CaptiveDependency`, `AmbiguousProvider`, `ModuleCycle`, `DuplicateModule`, `PrivateDependency`) has an analyzer fixture (a tiny tsconfig project) asserting the error code and file:line; the runtime-only cases (`LayerFailed`, `HandlerFailed`, `DuplicateTag`) stay as runtime tests. Every test that asserted a build-time graph error is ported or deliberately dropped in a list committed with the change. The showcase graph and errors pages render the analyzer's prebuilt JSON report. | fn-9-static-build-time-dependency-graph.2, fn-9-static-build-time-dependency-graph.6 | — |
| R11 | `sleekstack check [--project <tsconfig>] [--entry <file>...]` resolves roots as described in Architecture and exits 0 (ok), 1 (violations) or 2 (analyzer crash); `--json` writes only JSON to stdout; it runs as a Next `prebuild` step in showcase-kit and as a CI step before the tests, in under 5 seconds for the showcase. It resolves sources through the tsconfig project only and fails when a module resolves to an emitted `.js` / `.d.ts` sibling of a `.ts` file. | fn-9-static-build-time-dependency-graph.3 | — |
| R12 | `layer()` accepts a generator factory whose `yield*`ed Tags become its requirements, both at runtime (lazy, memoized resolution honoring lifetimes and finalizer order) and in the analyzer (edges, missing, captive, cycle checks); the array form is unchanged. Errors: yielding an unprovided Tag fails with `MissingDependency` at resolve time and as an analyzer error; a runtime re-entrant build fails with `DependencyCycle`; an `app`-lifetime layer yielding a `request` Tag is a captive error. | fn-9-static-build-time-dependency-graph.9 | — |

