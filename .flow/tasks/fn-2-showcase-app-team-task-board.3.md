---
satisfies: [R6, R7, R8, R9, R11]
---
# fn-2-showcase-app-team-task-board.3 Board UI: nested LayerProviders, component scopes, StrictMode, demo-mode client remount

## Description
The client board: the app → project → task-detail provider tree with async component-scoped services, Suspense and error boundaries, StrictMode, a client log of scope acquire and release, and the demo-mode remount.

**Size:** M
**Files:** apps/showcase/src/client/{Board.tsx,ProjectView.tsx,TaskDetail.tsx,ErrorBoundary.tsx,ScopeLog.tsx,DemoToggle.tsx}, src/client/component-services.ts (component-scoped service defs, client-safe: no server imports), app/providers.tsx ('use client', StrictMode root), src/__tests__/board.test.tsx, src/__tests__/renderStrict.tsx
**Touches:** [apps/showcase/src/client/**, apps/showcase/app/providers.tsx, apps/showcase/app/layout.tsx, apps/showcase/app/page.tsx, apps/showcase/src/__tests__/board.test.tsx, apps/showcase/src/__tests__/renderStrict.tsx, apps/showcase/vitest.config.ts]

### Approach
- The root `providers.tsx` wraps `<React.StrictMode><LayerProvider key={demoMode} provide={[ClientModule, ...demoClientEntries]}>`.
- ProjectView: `<LayerProvider provide={[ProjectFilterStore]}>`, an async component service built with Effect.sleep and acquireRelease that logs acquire and release.
- TaskDetail mounts with `key={taskId}` and provides DraftEditor (async, scoped). A "break detail" control mounts a variant whose acquire fails; ErrorBoundary follows `apps/playground/src/api-example.tsx:139-150`.
- Mutations call the .2 Server Actions from client handlers and render the `{ok:false, error}` result inline. They don't depend on thrown messages crossing the boundary. A "Simulate failure" checkbox is part of the create form.
- ScopeLog is a client-side list fed by the component services' acquire and release, shown next to the server log.
- Vitest: a jsdom project for *.test.tsx. Copy renderStrict from packages/react.

### Investigation targets
**Required:**
- packages/react/src/LayerProvider.tsx:122-161 (provide captured at mount; key remount)
- packages/react/src/useService.ts:57-69
- packages/react/src/__tests__/nesting.test.tsx, renderStrict.tsx
**Optional:**
- apps/playground/src/api-example.tsx:34-150

### Key context
- `provide` changes after mount are ignored (a dev warning), so always remount via `key`.
- useService needs a `<Suspense>` outside the provider.
- Client components import only `src/domain/tags.ts` and client-safe files, never `*.server.ts`.

### Acceptance
- [ ] board.test (renderStrict): opening task detail logs 1 acquire; closing it logs 1 release, child before project
- [ ] a failing detail acquisition shows the error boundary; the project and sibling stay mounted
- [ ] the demo toggle remounts, and the log shows the old scopes released
- [ ] `next dev` manual: create, move and comment work; the simulated failure shows its message
- [ ] typecheck and test green

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
