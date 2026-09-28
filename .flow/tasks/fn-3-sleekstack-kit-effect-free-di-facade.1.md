---
satisfies: [R1, R2, R3, R7, R8]
---
# fn-3-sleekstack-kit-effect-free-di-facade.1 Scaffold packages/kit + tag/layer/module/withCleanup/snapshot + errors + .d.ts emit check

## Description
Create the package and the whole Effect-free graph layer. This is the early proof point: the lowering onto core works, trailing-deps tuple inference holds, and the declaration emit is Effect-free. It also stubs the `next` and `react` subpath entries (empty barrels), so .2 and .3 never touch package.json.

**Size:** M
**Files:** packages/kit/{package.json,tsconfig.json,tsconfig.build.json,vitest.config.ts}, packages/kit/src/{index.ts,tag.ts,layer.ts,module.ts,errors.ts}, packages/kit/src/next/index.ts (stub), packages/kit/src/react/index.ts (stub), packages/kit/src/__tests__/{tag.test.ts,layer.test.ts,module.test.ts,errors.test.ts,types.test-d.ts,dts.test.ts}, pnpm-lock.yaml
**Touches:** [packages/kit/**, pnpm-lock.yaml]

### Approach
- package.json follows packages/next/package.json: `@sleekstack/kit`, private, `workspace:*` deps on core/next/react plus effect. Add an `exports` map for `.`, `./next` and `./react` pointing at the src entries (first subpath precedent; types condition too). Scripts: test, typecheck, `build:types` (`tsc -p tsconfig.build.json`, emitDeclarationOnly into `dist-types/`, gitignored).
- `tag<T>(name)`: returns a branded object that wraps a core Tag (`Context.GenericTag`), so an interface and a const merge. Abstract classes: `WeakMap<Function, Tag>` keyed by class reference, key = class name. The public token type is a union of the branded tag and `abstract new (...args: any) => T`.
- `layer(tag, impl, deps, opts)` lowers to core `service()` (packages/core/src/service.ts:33-57): resolve the tuple, spread it into the factory or constructor, wrap sync/Promise with a tryPromise-style adapter, and lower a `withCleanup` brand to acquireRelease. A plain value becomes `() => value`. Infer the deps tuple first, then type the impl against it (verify with a `.test-d.ts` repro early).
- `module({name, provide, imports, exports})` lowers to core `module()` (module.ts:84-116).
- `DuplicateTag`: export an internal `validateProvide(set)` that walks one provide set (transitive module imports plus each Layer's dep Tags) and throws on two distinct kit Tag objects with the same key. .2 and .3 call it from configureRuntime, action opts.provide and LayerProvider; .1 calls it from snapshot. Same key across boundaries is Shadowing, so never compare across sets.
- errors.ts: `SleekStackError extends Error {code, details}`, plus an internal `normalize(unknown)` that converts core tagged errors (packages/core/src/errors.ts), kit sentinels and plain throws. .2 and .3 reuse it at their boundaries. Never export the core error classes.
- Opaque public types: `Tag<T>`, `Layer<T>`, `Module` and `FinalizerError {message, tag?}` as branded interfaces with no Effect members. The core entry sits behind a private symbol, with an internal `unwrap()` for .2/.3.
- Callables: a function impl is a factory; a class (detected by `class` syntax via Function.prototype.toString) is constructed; the value overload excludes callables at the type level.
- `snapshot(App)` delegates to core `snapshot(buildGraph(...))`.
- Keep Effect imports internal. Internal types use `import type` or live in non-exported positions.
- dts.test: run `build:types`, glob `dist-types/**/*.d.ts`, assert ≥1 file and no `effect` or `@sleekstack/(core|next|react)` substring. Add a second check with the TS compiler API: load `src/index.ts` (and later the subpath entries), resolve each exported symbol's type, and assert no declaration file of it (recursively through properties and signatures, depth-capped) lives under `effect` or the core/next/react packages. Follow the bundle-test pattern (fn-2 branch apps/showcase/src/__tests__/bundle.test.ts).

### Investigation targets
**Required:**
- packages/core/src/index.ts, service.ts:33-57, module.ts:84-116, errors.ts, graph.ts (buildGraph, snapshot)
- packages/next/package.json, packages/core/vitest.config.ts, tsconfig.base.json
**Optional:**
- packages/core/src/__tests__/service-types.test-d.ts, module-types.test-d.ts

### Key context
- An interface and a const must both be exported, or tsc errors (TS#50880).
- `new (...)=>T` rejects abstract classes; use `abstract new`.
- tsc emits types into .d.ts regardless of `@internal`; only the grep test proves R7.
## Acceptance
- [ ] tag/abstract-class Tags resolve in a built graph; empty name throws; same-key distinct Tags -> DuplicateTag; same class twice -> same Tag
- [ ] layer: factory, async factory, class, value and withCleanup all work; cleanup runs on scope close; a throwing cleanup reaches onFinalizerError; an array service is returned as-is; a factory throw surfaces as LayerFailed with the Tag name
- [ ] every core graph error is reproduced via the kit API as SleekStackError with the right code
- [ ] types.test-d: deps infer factory params; a wrong return type is a compile error
- [ ] snapshot(App) deep-equals core snapshot for the same graph
- [ ] dts.test green (non-vacuous); typecheck and test green
- [ ] validateProvide: duplicate key in one set -> DuplicateTag (unit-tested directly and via snapshot); same key across sets is allowed
- [ ] layer(Transform, n => n + 1) is treated as a factory; `() => fn` yields the function service; a callable plain value is a type error
- [ ] compiler-API surface check green
## Done summary
Scaffolded @sleekstack/kit: tag/abstract-class Tags, layer (factory/async/class/value/withCleanup), module, snapshot, SleekStackError, plus internal normalize/validateProvide/unwrap/coreTag for .2/.3 (stripped from .d.ts via stripInternal). Tests cover all ACs incl. every core graph error, DuplicateTag, LayerFailed, finalizer sink, type inference (types.test-d.ts), and Effect-free .d.ts text + compiler-API checks (dts.test.ts). next/react entries are empty stubs.

stage: impl-review - ran (codex, SHIP first pass)
## Evidence
- Commits: cb13bb9708e6e00dc9ad45dfe939a9c5193df4d5
- Tests: pnpm --filter @sleekstack/kit typecheck, pnpm --filter @sleekstack/kit test, pnpm --filter @sleekstack/kit build:types
- PRs: