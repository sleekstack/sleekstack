---
satisfies: [R6, R7]
---
# fn-3-sleekstack-kit-effect-free-di-facade.3 @sleekstack/kit/react: LayerProvider, useService, useServices

## Description
The React adapter: core LayerProvider re-exported, typed `useService` for kit Tags, and a kit-level `useServices`.

**Size:** S/M
**Files:** packages/kit/src/react/{index.ts,hooks.ts}, packages/kit/src/__tests__/react.test.tsx, packages/kit/src/__tests__/renderStrict.tsx, packages/kit/vitest.config.ts (add jsdom for *.test.tsx)
**Touches:** [packages/kit/src/react/**, packages/kit/src/__tests__/react*.tsx, packages/kit/src/__tests__/renderStrict.tsx, packages/kit/vitest.config.ts]

### Approach
- Re-export `LayerProvider` from @sleekstack/react (LayerProvider.tsx:122-161) unchanged.
- `useService(tag)`: map the kit Tag to its core Tag, then call react's `useService` (useService.ts:57-68).
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

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
