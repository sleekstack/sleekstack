---
satisfies: [R6, R7]
---
# fn-3-sleekstack-kit-effect-free-di-facade.3 @sleekstack/kit/react: LayerProvider, useService, useServices

## Description
The React adapter: a kit-typed `LayerProvider` wrapping core's, a typed `useService` for kit Tags that normalizes errors, and a kit-level `useServices`.

**Size:** S/M
**Files:** packages/kit/src/react/{index.ts,hooks.ts}, packages/kit/src/__tests__/react.test.tsx, packages/kit/src/__tests__/renderStrict.tsx, packages/kit/vitest.config.ts (add jsdom for *.test.tsx)
**Touches:** [packages/kit/src/react/**, packages/kit/src/__tests__/react*.tsx, packages/kit/src/__tests__/renderStrict.tsx, packages/kit/vitest.config.ts]

### Approach
- Kit `LayerProvider`: a thin wrapper around core's (LayerProvider.tsx:122-161). Kit props: `provide: ReadonlyArray<Layer | Module>` and `onFinalizerError?: (e: FinalizerError) => void`. Call .1 `validateProvide`, unwrap memoized on the `provide` reference (core's sameEntries check and StrictMode park/adopt must see stable arrays), and convert the Cause to FinalizerError. Don't touch the core runtime. <!-- Updated by plan-sync: fn-3.2 used unwrap()'s Module passthrough, not flattening, for the same reason here — core's `LayerProviderProps.provide` is `ReadonlyArray<Entry | Module>` (LayerProvider.tsx:26), so a flattened Module's entries lose module identity and local-over-import Shadowing turns into AmbiguousProvider. Pass `unwrap(provide)` through unchanged, matching packages/kit/src/next/action.ts:46-51. -->
- `useService(tag)`: map the kit Tag to its core Tag and call react's `useService` (useService.ts:57-68) in a try/catch; rethrow thenables unchanged (Suspense) and throw `normalize(err)` otherwise, so boundaries see SleekStackError.
- `useServices(tags)`: call `useService` per Tag, with a tuple-mapped return type; in dev, warn when the array length changes between renders (a ref).
- Tests: copy renderStrict from packages/react/src/__tests__/renderStrict.tsx. StrictMode gives 1 acquire and 1 release for a component-lifetime Layer with withCleanup; a failing acquire reaches the error boundary; useServices returns in order.

### Investigation targets
**Required:**
- packages/react/src/LayerProvider.tsx, useService.ts, index.tsx
- packages/react/src/__tests__/nesting.test.tsx, renderStrict.tsx

### Key context
- react internals (context.ts cache) are private; use only the public exports.
- Suspense must be outside the provider.
## Acceptance
- [ ] useService/useServices suspend and return typed plain values
- [ ] StrictMode: exactly 1 acquire / 1 release per real mount
- [ ] failing acquisition -> error boundary
- [ ] dev warning on useServices length change
- [ ] dts.test still green (react subpath included); typecheck and test green
- [ ] boundary receives SleekStackError (with .code) for a failing Layer
- [ ] duplicate Tag in one provide -> DuplicateTag; parent/child same key shadows
- [ ] onFinalizerError gets a plain FinalizerError
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
