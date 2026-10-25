---
satisfies: [R4, R6]
---
# fn-71-class-controllers-and-service-classes.3 analyze and check: declared dependencies count as requirements; the Manifest finds class methods

Touches: [packages/analyze/src/controllers.ts, packages/analyze/src/rpc.ts, packages/analyze/src/__tests__/controllers.test.ts, packages/analyze/src/__tests__/rpc.test.ts, packages/analyze/src/__tests__/fixtures/**, packages/cli/src/check.ts, packages/cli/src/__tests__/check.test.ts, packages/cli/src/__tests__/fixtures/**]

## Description
Make `sleekstack check` treat a class Controller's declared Tags as requirements, with the same providers as a method's `R`, and let the RPC Manifest wrap a class Controller's method.

**Size:** M
**Files:** `packages/analyze/src/controllers.ts`, `packages/analyze/src/rpc.ts`, the analyzer and CLI tests and fixtures, `packages/cli/src/check.ts` if the report shape changes
**Touches:** [packages/analyze/src/controllers.ts, packages/analyze/src/rpc.ts, packages/analyze/src/__tests__/controllers.test.ts, packages/analyze/src/__tests__/rpc.test.ts, packages/analyze/src/__tests__/fixtures/**, packages/cli/src/check.ts, packages/cli/src/__tests__/check.test.ts, packages/cli/src/__tests__/fixtures/**]

### Approach
- The requirement check is `controllers.ts:394-426`: `isProvided` (request services, app layer including Layer Files, `start({ layer })`) and the tags a `wrap` above discharges (`provided`, `:398-414`). Add the declared Tag record's Tag symbols (resolved by the checker from `Controller({...})`) to each method's requirement set so the same rule applies; the message at `:422` names the class.
- A declared Tag provided by a `wrap` counts, since the instance is built inside it.
- `analyzeRpc` looks a wrapped Controller Method up with `exportsOf(controller).find(e => e.name === verb)` then `signatureOf` (`rpc.ts:256-267`); add the class-method lookup so a Manifest entry naming a class method is not `RpcRouteUnknown`. A class entry has no named export, so reuse the class reader of task 2.
- `packages/cli/src/check.ts:111-177` consumes the report; change it only if the shape changes.
- Add fixtures for a class declaring a Tag nobody provides, one provided by a `wrap`, one by a Layer File, and a Manifest entry naming a class method.

### Investigation targets
**Required**:
- `packages/analyze/src/controllers.ts:394-426`
- `packages/analyze/src/rpc.ts:256-267`
- `packages/cli/src/check.ts:111-177`

### Acceptance
- [ ] a declared Tag nobody provides is `MissingDependency` naming the class; one provided by a `wrap`, a Layer File or `start({ layer })` is not
- [ ] a Manifest entry naming a class Controller Method analyzes with the method's schemas and no `RpcRouteUnknown`
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack` passes, and `pnpm --filter realworld check` and `pnpm --filter showcase check` still exit 0

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
- <!-- Updated by conductor: fn-71.2 shipped. `ControllerDecl` gained `kind: 'functions' | 'class'` and `declared: readonly ControllerDependency[]` (`{ name, tag: ts.Type, location }`, written order, empty for named exports; the type is exported from `@sleekstack/analyze`); `ControllerMethod` is unchanged. `tag` is the type of the declared value (`typeof Users`): match it against provided Tags with `tag.getSymbol()`. A class method's location is its member line; `ControllerDecl` has no class location, so a `MissingDependency` that names the class uses the dependency's location (or add a class location). The `Gen` reading lives in `typeSchema.ts` (`genOf`): the written return type node must name `Gen` from `@sleekstack/start` by its imported symbol. -->
