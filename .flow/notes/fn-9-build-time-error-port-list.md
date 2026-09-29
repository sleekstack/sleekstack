# fn-9: build-time graph error tests, port list (R10)

Every test that asserts a build-time graph error (`MissingDependency`, `DependencyCycle`, `CaptiveDependency`,
`AmbiguousProvider`, `ModuleCycle`, `DuplicateModule`, `PrivateDependency`) through `buildGraph` / `snapshot`,
with its analyzer port target or a deliberate drop. Fixtures live in `packages/analyze/src/__tests__/fixtures/`
and are asserted by `fixtures.test.ts` (code + file:line from `// @error` markers, and the runtime agreeing while
`buildGraph`/`snapshot` still exist). Task 7 deletes the `buildGraph` validation; the tests marked **port** below
are then deleted from core/kit (their analyzer port stays), **keep** tests stay as runtime tests.

Legend: **ported** = analyzer fixture exists; **keep** = runtime path that survives task 7 (dynamic boundary,
resolve-time backstop, lazy build), not a build-time error; **drop** = not ported, with reason.

## packages/core

| Test | Error | Decision | Target |
| --- | --- | --- | --- |
| graph.test `service requiring a Tag only a bare Layer provides -> MissingDependency with declareLayer hint` | MissingDependency | ported | `ported/core.ts` `Data` (message checks the hint) |
| graph.test `dependency cycle -> DependencyCycle with Tag path` | DependencyCycle | ported | `dependency-cycle/core.ts` |
| graph.test `same Tag at the same precedence -> AmbiguousProvider naming both modules` | AmbiguousProvider | ported | `ambiguous-provider/core.ts`, `ambiguity-follow-on` (message names both modules) |
| cycle.test `identity cycle through thunk imports -> ModuleCycle with full path` | ModuleCycle | ported | `module-cycle/core.ts` |
| cycle.test `distinct modules sharing a name -> DuplicateModule` | DuplicateModule | ported | `duplicate-module/core.ts` (nested form). The two-top-level-roots form is dropped: the analyzer validates each root module separately, so two unrelated roots sharing a name are two graphs, not one |
| cycle.test `A(new) -> B -> A(old) is DuplicateModule, not a cycle` | DuplicateModule | ported | `ported/core.ts` `NewA` |
| walk.test `cycles are skipped, not thrown (buildGraph still throws ModuleCycle)` | ModuleCycle | ported (the buildGraph half) | `module-cycle`; the walkProvide half stays a runtime test |
| lifetime.test `rejects app -> request` | CaptiveDependency | ported | `captive-dependency/core.ts` |
| lifetime.test `rejects request -> component`, `rejects component -> request` | CaptiveDependency | ported | `ported/core.ts` `ReqToComp`, `CompToReq` |
| lifetime.test `allows request/component -> app and same-lifetime edges` | (none) | ported | `ported/core.ts` `ShortToApp` (no error) |
| lifetime.test `checks declared Layers (module lifetime applies)` | CaptiveDependency | ported | `ported/core.ts` `DeclaredCaptive` |
| privacy.test `a node outside the module requiring a private Tag -> PrivateDependency` | PrivateDependency | ported | `private-dependency/core.ts` |
| privacy.test `same-module requires work; omitted exports = all public; outside shadowing allowed` | (none) | ported + keep | `ported/kit.ts` `OpenApp`, `ShadowApp` (no error); the public-Context / `privateDependencyOf` half stays runtime |
| privacy.test `child scopes: outside entries cannot require a private Tag...` | PrivateDependency | keep | child-scope (dynamic boundary) path |
| resolve.test `each` (private, missing) | Private/MissingDependency | keep | resolve-time backstop (`resolveTag`) |
| spike.test `missing dependency names requiring service and missing Tag` | MissingDependency | drop | tests the fn-1 `order`/`wire` spike module, not `buildGraph`; covered by `missing-dependency` |
| spike.test `A requires B, B requires A -> DependencyCycle with path` | DependencyCycle | drop | same spike module; covered by `dependency-cycle` |
| scope.test `rejects duplicate providers among boundary entries` | AmbiguousProvider | keep | child-scope boundary (per-call entries) |
| lazy.test `re-entering a key on the chain fails with DependencyCycle` | DependencyCycle | keep | lazy-build runtime backstop (R12); analyzer side is `generator-layers` |
| atom-scope.test `resolves public and shadowed Tags; missing/private give typed failures`, `keeps the rest of a compound Cause` | Missing/PrivateDependency | keep | resolve-time failures |

## packages/kit

| Test | Error | Decision | Target |
| --- | --- | --- | --- |
| errors.test `core graph errors via the kit API` (each: Missing, Cycle, Ambiguous, ModuleCycle, DuplicateModule, Captive) | all six | ported | the matching `*/kit.ts` fixtures; the error-detail fields (service, missing, path, modules) are the analyzer's messages, checked in `ambiguity-follow-on` |
| module.test `requiring a private Tag from outside -> SleekStackError PrivateDependency` | PrivateDependency | ported | `private-dependency/kit.ts` |
| module.test `DuplicateTag wins over AmbiguousProvider for two direct same-key providers` | AmbiguousProvider (buildGraph half) | drop | the buildGraph half asserts core's raw ordering, removed with it; the DuplicateTag half stays runtime (`validateProvide`) |
| module.test `a cyclic module set passes definition-time validation and fails at invocation` | ModuleCycle | ported | `module-cycle/kit.ts` (thunk import); the definition-time half stays runtime |
| effect.test `graph rules apply to its deps; it shows in the snapshot` | MissingDependency | ported | `ported/kit.ts` `EffectApp`; `effect:job` node is covered by `kit-app` |
| tag.test `distinct same-key Tags in one set -> DuplicateTag (direct and via snapshot)` | DuplicateTag | keep | runtime-only (R10); the "via snapshot" form moves to `validateProvide` / `configureRuntime` when task 7 deletes `snapshot` |
| layer.test `unprovided yield -> MissingDependency`, `re-entrant build -> DependencyCycle` | Missing, Cycle | keep | runtime (R12); analyzer side is `generator-layers` |
| next.test `a missing dependency rejects`, `a private action dependency rejects`, `yield*-ing an unprovided Tag rejects` | Missing, Private | keep | resolve-time backstop; analyzer side is `actions` |
| boundaries.test.tsx `missing -> MissingDependency`, `private -> PrivateDependency` | Missing, Private | keep | `LayerProvider` (props at runtime, not analyzed) |

## apps

| Test | Decision | Target |
| --- | --- | --- |
| showcase-kit errors.test gallery (7 graph cases via `snapshot`) | ported | `src/errors/graphs.ts`, asserted from the analyzer report; runtime-only InvalidModule / DuplicateTag / InvalidTag stay |
| showcase-kit graph.test `the app graph builds without...` | ported | `pnpm check` (CI + prebuild) and `parity.test.ts`; task 7 deletes graph.test with `snapshot` |
| apps/showcase (core) | not ported here | the working tree is being migrated away from sleekstack modules (`modules.server.ts` deleted, uncommitted); the core-declared parity is pinned by `packages/analyze` `core-app` fixture vs `buildGraph` |
