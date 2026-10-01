# The dependency graph is validated statically, at build time

Supersedes [ADR 0004](0004-hybrid-service-definitions.md) (in part: metadata is still carried, but read statically), [ADR 0005](0005-dependency-arrays-over-inject.md) (for actions and queries), and the build-time half of [ADR 0006](0006-enforce-module-privacy.md).

> **Amended 2026-10-01:** the runtime no longer keeps a Resolution Plan. Entries build in position order (deepest import first, root entries last; later wins), runtime privacy and shadowing metadata are gone, and `declareLayer()` carries only a lifetime.

A static analyzer, `@sleekstack/analyze` (run as `sleekstack check`), is the only place the whole graph is validated. It reads the same `tag` / `layer` / `module` / `service` / `defineEffect` / `defineQuery` / `effect` / `query` / `configureRuntime` declarations the runtime uses, through the TypeScript checker, without importing or executing app code, and reports missing, cyclic, captive, ambiguous, private-Tag, module-cycle and duplicate-module violations with file:line. `defineEffect` / `defineQuery` / `effect` / `query` drop their deps array: deps are the Tags the generator `yield*`s, followed through helper generators. `layer(Tag, function* () { ... })` infers its requirements the same way. A Tag the body never yields but whose layer must run (`RequestContext`) is declared with `opts.scope`. Core no longer builds a validated graph: `buildGraph` validation and `snapshot` are gone, and scopes consume an internal `ResolutionPlan` (`buildPlan(entries)`) that only orders and shadows.

## Why ADR 0005's compiler-plugin rejection no longer holds

ADR 0005 rejected parameter reflection through a compiler plugin because every toolchain (Next's SWC, Vite, tsc) would need a build plugin plus emit metadata, and types are erased at run time. The analyzer is not a plugin: it is a checker CLI that runs beside the build (a `prebuild` step, a CI step before the tests). It emits nothing and transforms nothing, so runtime code needs no plugin and no emitted metadata, and every bundler sees plain source. The edges it needs exist only in types, and the checker reads types.

## Considered options

- **Keep arrays, cross-check them in a graph test** (the previous state): rejected. Validation ran only when app code was imported and executed, the array and the body could drift, and `snapshot` was a second graph kept only for checking.
- **Manifest-only analyzer, `snapshot` as validator**: rejected. It keeps two graphs.
- **Lazy resolution with no analyzer**: rejected. It loses undeclared-Tag isolation and any pre-flight guarantee.
- **Type-level-only inference**: rejected. Erased at run time, and gives tests no list.
- **Fully static analyzer as sole validator** *(chosen)*.

## Consequences

- **Lock-in.** Without the array, nothing at run time lists an action's deps, so the analyzer is mandatory: an app that skips `sleekstack check` loses missing/private/captive detection for actions and gets only the resolve-time `MissingDependency` / `PrivateDependency` backstop. The analyzer is built on the raw TypeScript compiler API (`typescript` is a peer dependency, no ts-morph), so it tracks TypeScript's API and the checker's type output.
- **Fail closed.** The analyzer evaluates expressions (loops, conditionals, `.map` / `.filter` / `.concat`, local helpers) over precisely typed sources and over-approximates: a maybe-provided Tag counts as provided, a maybe-present edge counts for cycle and captive checks. A declaration it cannot read (`any`, `Layer<any>[]`, a non-literal key, a factory-returned body, an ambient list with no readable initializer) is a located error. There is no opt-out.
- **Roots.** Each `configureRuntime` call outside test files is a root, validated as its own graph. `--entry` (or `sleekstack.entry` in package.json) restricts roots to the given files; it is an allowlist, so a `configureRuntime` call outside it is not checked.
- **Runtime isolation for actions is dropped.** An action no longer runs under a Context narrowed to declared deps; `yield*` reads the request scope's public Context on demand. The analyzer enforces what the narrowing used to.
- **Two runtime paths.** The root plan (app and provider entries the analyzer vetted) does not validate: ties go to the first provider and cycles surface lazily as `DependencyCycle`. The dynamic-boundary path (per-call `provide`, child scopes, `LayerProvider` entries built from props) still validates and throws `AmbiguousProvider`, `DependencyCycle` and `DuplicateTag`. Private Tags stay hidden from a scope's public Context, so a miss still explains itself.

## Known limits

- A kit `tag()` or Effect `GenericTag` that reaches an action only through an Effect's `R` (not a direct `yield*` of the Tag) reports `Unresolvable`: fail closed, not inferred.
- Atoms keep their deps array; the analyzer reads it as edges.
- `LayerProvider` graphs are built from props at run time and are not analyzed; resolve-time `MissingDependency` is their backstop.
- Over-approximation can hide a missing dependency that only occurs in one branch.
