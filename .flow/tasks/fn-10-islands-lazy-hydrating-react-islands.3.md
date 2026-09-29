---
satisfies: [R5]
---
# fn-10-islands-lazy-hydrating-react-islands.3 react: LayerProvider accepts an externally owned app scope

Touches: packages/react/src/LayerProvider.tsx, packages/react/src/managedScope.ts, packages/react/src/__tests__/**, packages/kit/src/react/**

## Description
The one additive seam Islands need: a top-level `LayerProvider` can be given an app scope it does not own, so several React roots can share one app scope.

**Size:** M
**Files:** packages/react/src/{LayerProvider.tsx,managedScope.ts}, packages/react/src/__tests__/layerProvider.external.test.tsx, packages/kit/src/react/index.ts (re-export only if the option must be visible through kit)
**Touches:** packages/react/src/**, packages/kit/src/react/**

### Approach
- In `managedScope.ts` `create()`: today a top-level provider builds `makeAppScope(buildGraph(provide))` itself and pushes it onto `owned` (closed in reverse). Add an optional externally owned app scope input: use it instead of building one, derive the component scope from it, and do not push it onto `owned`.
- Thread the option through `LayerProviderProps` (`packages/react/src/LayerProvider.tsx`). Keep the existing adopt/park StrictMode behavior (`ADOPT_MS`) unchanged.
- Keep the kit facade free of Effect and core types: expose the option through kit only if needed, as an opaque handle.
- Tests: two providers sharing one external scope see the same service instance; closing a provider does not close the external scope; behavior without the option is unchanged (existing tests stay green).

### Investigation targets
**Required**:
- `packages/react/src/managedScope.ts:101-130`, `:156`, `:167` - `create`, `acquire`, `mount`
- `packages/react/src/LayerProvider.tsx:27,56` - props and component
- `packages/react/src/context.ts` - `ProviderState`
- `packages/kit/src/react/index.ts` - kit re-exports

## Acceptance
- [ ] Two providers with the same external app scope resolve the same app-lifetime service instance
- [ ] Unmounting a provider never closes an external app scope
- [ ] Existing packages/react and kit tests unchanged and green
- [ ] No Effect or core types leak through `@sleekstack/kit/react`

## Done summary
`@sleekstack/react` LayerProvider takes an optional `appScope` (externally owned; top-level only, ignored when nested; never closed by the provider), plus `closeProvidersOn(appScope)` so the owner closes component scopes before the app scope. Kit exposes it opaquely: `createAppScope(provide, { onFinalizerError })` returns an `AppScopeHandle` (`close()`), and kit `LayerProvider` accepts `appScope` - no Effect/core types in `@sleekstack/kit/react`.

Tests: packages/react/src/__tests__/layerProvider.external.test.tsx, packages/kit/src/react/__tests__/appScope.test.tsx (shared instance, unmount never closes, close ordering component-before-app).

Tier: opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK x2 -> re-review SHIP)
## Evidence
- Commits: bf9e6974adb3e655fa364e408cc52dd077757c74, ea63e88487b2a0b8c47db6ea7e40577e5ac44abe, efd42e1cca0d3c97f469b53a711d062ee55b74d5, 778cdb778136bfe64b71036cc9a1eb9356396f63, c57a55d344f553f7d22949d2b2822818f39a3219
- Tests: pnpm --filter @sleekstack/react test, pnpm --filter @sleekstack/react typecheck, pnpm --filter @sleekstack/kit test, pnpm --filter @sleekstack/kit typecheck
- PRs: