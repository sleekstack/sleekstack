---
satisfies: [R3]
---
# fn-71-class-controllers-and-service-classes.2 analyze: read a default-exported class Controller

Touches: [packages/analyze/src/controllers.ts, packages/analyze/src/serverServices.ts, packages/analyze/src/__tests__/controllers.test.ts, packages/analyze/src/__tests__/fixtures/**, packages/analyze/src/index.ts]

## Description
Teach the Controller pass to read a `*.controller.ts` whose default export is a class extending `Controller(...)`, producing the same `ControllerMethod` records as a named export, and report the five invalid shapes as `ControllerMethodShape`.

**Size:** M
**Files:** `packages/analyze/src/controllers.ts`, `packages/analyze/src/serverServices.ts`, `packages/analyze/src/__tests__/controllers.test.ts`, fixtures under `packages/analyze/src/__tests__/fixtures/`, `packages/analyze/src/index.ts`
**Touches:** [packages/analyze/src/controllers.ts, packages/analyze/src/serverServices.ts, packages/analyze/src/__tests__/controllers.test.ts, packages/analyze/src/__tests__/fixtures/**, packages/analyze/src/index.ts]

### Approach
- First a short spike: `readSignature` (`serverServices.ts` ~99-106) and `requiresOf` read `Effect.Effect` by the `effect/Effect#Effect` lib id (`controllers.ts:36`). Decide how to read `Gen<A, E, R>`: by the imported symbol of `@sleekstack/start`, taking its three type arguments as success, error and requirement. Record the decision in the task summary.
- `signatureOf` (`controllers.ts:49-55`) accepts only function declarations and variables; add a `MethodDeclaration` branch. Reuse `methodOf` (`:301-364`) by passing it the signature and a label, with the same `inputRule`, `fromStrings`, params-versus-path check and `locationOf`; do not copy it.
- The default-export dispatch is at `:379-392` and today reports every `default` as `ControllerMethodShape` (`:386-391`). Add only the class branch: a default export whose class extends `Controller(...)` directly. Leave a `records(...)` default (fn-70) to that spec's branch; if fn-70.5 has landed, rebase on it and keep both.
- `ControllerMethod`/`ControllerDecl` (`:100-117`) gain the class kind and the declared Tag keys the codegen needs; keep the report backward compatible.
- Options (`wrapOf` `:161-173`) stay named exports and need no change.
- Invalid shapes (each a fixture and a test naming file, line and fix): no HTTP-named method, a non-generator HTTP-named member, a missing written `Gen`, a class not extending `Controller(...)` directly, and a default class together with a named Controller Method export.
- Memory notes: the analyzer needs a dedicated branch plus a fixture per branch; options such as `serverDir` must reach every pass; any plugin memoization resets per build.

### Investigation targets
**Required**:
- `packages/analyze/src/controllers.ts:36-55, 100-117, 161-173, 301-392`
- `packages/analyze/src/serverServices.ts:99-153` - `readSignature`, `requiresOf`
- `packages/analyze/src/__tests__/controllers.test.ts` - the fixture and test pattern
**Optional**:
- `packages/analyze/src/rpc.ts:256-267` - the lookup task 3 changes

### Acceptance
- [ ] a fixture class Controller yields the same methods, schemas and `requires` as an equivalent named-export Controller
- [ ] one fixture and test per invalid shape, each a `ControllerMethodShape` naming file and line
- [ ] a `records(...)` default export is not reported as `ControllerMethodShape` by this branch, or the task notes why fn-70 owns it
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack` passes

## Acceptance
- [ ] TBD

## Done summary
The Controller pass reads a `*.controller.ts` whose default export is a class extending `Controller(...)` directly, producing the same `ControllerMethod` records (names, input/success schemas, `requires`) as the equivalent named-export Controller. The five invalid shapes are each a `ControllerMethodShape` naming file, line and fix; no new `AnalyzeCode`.

Gen-reading decision: `readSignature` (serverServices.ts) takes a different branch for a generator `MethodDeclaration`. It reads the written return type node with `genOf` (typeSchema.ts), which matches a type reference whose name resolves by imported symbol to `start/class#Gen`, so an aliased import works. Its type arguments, read with `getTypeFromTypeNode`, are success, error and requirement, and a missing `E` or `R` is `never`. Reading the resolved type does not work: `Gen` is an alias of `Generator<YieldWrap<...>>`, and TypeScript attaches no `aliasSymbol` to an interface reference. A local `type X = Gen<...>` does not match and is refused as a missing written `Gen`. A named-export `function*` keeps the Effect-only path. `methodSchema` takes the success Schema node from `Gen`'s first argument as it does for `Effect.Effect`.

Report: `ControllerDecl` gains `kind: 'functions' | 'class'` and `declared: readonly ControllerDependency[]`, where `ControllerDependency = { name, tag: ts.Type /* typeof Tag */, location }` is exported from `@sleekstack/analyze`. Methods keep their shape. The location of a class method is the member.

fn-70: fn-70 has not landed. A `records(...)` default export is not a class, so it still reaches the existing "exports \"default\", which is not served" report unchanged. fn-70 owns that branch.

Tests: packages/analyze/src/__tests__/controllers.test.ts. The class-equals-named test covers `twin/class/[id]` against `twin/named/[id]`, plus the declared Tags. One row per invalid shape is in the it.each over `classes/{no-method,not-generator,no-gen (missing and local alias),indirect,two-forms}.controller.ts`, and the `@error` markers are read by the file:line test.

stage: impl-review - skipped(policy: user asked for one completion review at the end of the spec)
## Evidence
- Commits: 819b79c3c19373bb3e0569cffd231d3249944594
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/start..., pnpm --filter realworld check, pnpm --filter showcase check, pnpm format:check
- PRs: