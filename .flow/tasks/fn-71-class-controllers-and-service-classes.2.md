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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
- <!-- Updated by conductor: fn-71.1 shipped. `Gen<A, E = never, R = never>` is `Generator<YieldWrap<Effect.Effect<any, E, R>>, A, any>` exported from `@sleekstack/start` (`packages/start/src/class.ts`), so the analyzer reads a `Gen` reference's three type arguments (success, error, requirement) by the imported symbol; the spike only has to confirm that. A class field before a `*GET()` member needs a trailing `;` in fixtures (Prettier keeps it). -->
