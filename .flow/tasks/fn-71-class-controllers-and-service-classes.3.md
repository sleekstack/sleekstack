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
The Controller pass now checks a class Controller's declared Tags by the same rule as a method's `R` (request services, `start({ layer })`, Layer Files, a `wrap` above it). A declared Tag nobody provides is `MissingDependency` at the declaration line, naming the route and class (`Controller "classes/declared" class Declared declares "audit" as "Audit", ...`). `analyzeRpc` finds a Manifest entry's method as a generator method of the default class, through the shared `defaultClassOf` reader now exported from controllers.ts. It reads success through `Gen` for the Response check. A missing class method is `RpcRouteUnknown` ("has no generator method DELETE in its Controller class"). No new AnalyzeCode, and the report shape is unchanged, so check.ts needed no change.

Tests: packages/analyze/src/__tests__/controllers.test.ts reads the fixtures `classes/declared.controller.ts` (Audit unprovided, Users from start, Clock from a Layer File, Request a request service) and `users/declared.controller.ts` (Viewer provided by the directory wrap). packages/analyze/src/__tests__/rpc.test.ts covers `Items.note` over `api/notes/[id]` (a class method: input, success and controller) and `Broken.method` (RpcRouteUnknown).

Drift for task 4: an RpcMethod of a class-backed entry carries the same `controller: { route, method }` as a function entry, with no kind. ui-vite's `server-services.ts:315-319` emits `{ file, name: verb }` as a named import. For a class it must tell the forms apart, either by `ControllerDecl.kind` from analyzeControllers keyed by route or by the generated ControllerEntry's `run`, and then build the instance.

stage: impl-review - skipped(policy: user asked for one completion review at the end of the spec)
Tier: implementer opus at medium
## Evidence
- Commits: 3335ed560948aff753247644308388aedf00e620
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/start..., pnpm --filter realworld check, pnpm --filter showcase check, pnpm format:check
- PRs: