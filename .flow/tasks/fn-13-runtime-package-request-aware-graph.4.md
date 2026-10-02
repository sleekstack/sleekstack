---
satisfies: [R3]
---
# fn-13-runtime-package-request-aware-graph.4 Tracer/Supervisor-based devtools events and richer panel

Touches: packages/runtime/src/**, packages/next/src/devtools.ts, packages/kit/src/next/runtime.ts, packages/devtools/src/panel/**, packages/devtools/src/index.tsx

## Description
**Task 1 drift:** the devtools buffer (devEvents/devLive/devEnabled, DevEvent) lives at the `@sleekstack/runtime/internal` subpath (not the main barrel); import from there. Kit already sets `isControlFlow: isNextControlFlow` in its runtime config.

**Touches:** packages/runtime/src (event model, tracing layer), packages/next/src/devtools.ts, packages/kit/src/next/runtime.ts, packages/devtools/src (new panel section files plus the panel entry that mounts them)

**Files:** packages/runtime/src (new tracing module), packages/next/src/devtools.ts, packages/kit/src/next/runtime.ts (service-construction seam), packages/devtools/src/{panel sections, new files}

Supervisor and spans do not expose individual Layer service acquire/release, so the per-service seam lives where services are built: kit's lowering of modules into the app-scope/request Layers wraps each service Layer with an optional lifecycle hook (a runtime-provided Context tag, no-op when absent) that emits acquire/release with the Tag/service id. Plain Layers handed straight to the runtime only get whole-layer app/request events; say so in docs. Replace hand-placed `record()`/`setLive` calls with a dev-only tracing layer installed by the runtime: Supervisor for fiber ids and owning request scope, spans for per-service acquire/release (a targeted Layer wrapper is acceptable where Supervisor cannot observe Layer.build). Identify services by the same ids the analyzer uses so the panel can correlate. Errors keep a link to their scope id even after the scope leaves `live`. Never replace a user-installed Tracer; wrap all hooks in try/catch so they cannot fail a request; guard installation on NODE_ENV so production does no work (extend the bundle/production test). Keep the live state separate from the 200-event history. Handler returns a `disabled` flag distinct from empty data. Panel adds acquire/release and error-to-scope sections, loading/off/empty states preserved.

## Acceptance
- [ ] Per-service acquire/release events and fiber ids appear for a request; an error links to its request scope
- [ ] Tracing disabled or handler off renders the empty/disabled state; production records nothing (test)
- [ ] A user Tracer is left intact; a throwing hook does not fail the request
- [ ] Existing 19 next tests and 9 devtools tests still pass

## Done summary
Devtools now shows acquire/release for each service, the fiber id, and the request scope each error belongs to. The runtime exports `traceService(id, layer)` from `@sleekstack/runtime/internal`. A FiberRef carries the owning config and scope: the runtime sets it to `app` around the app build and to `request#N` around each runEffect call. In dev only, kit wraps each ServiceDefinition and DeclaredLayer with this hook. The wrapper uses the Tag key, which is the same id the analyzer gives the node. Wrapped entries are cached so module and entry identity holds. Bare Layers and plain Layers passed straight to the runtime still get only whole-layer app/request events. Each error records its `scope`. `record()` never throws. The snapshot has a `disabled` flag. The panel adds two sections, services and scoped errors (packages/devtools/src/panel/sections.tsx), and a disabled state.

Deviation: no Supervisor and no Tracer is installed. Fiber ids come from `Effect.fiberId` inside the hook, and the FiberRef records which request owns a service. Because nothing is installed, a user's Tracer is left alone, and a test shows it still receives spans.

Tests:
- packages/kit/src/__tests__/next.test.ts: per-service events; production records nothing.
- packages/next/src/__tests__/devtools.test.ts: an error links to its closed scope; a user Tracer is intact and a throwing hook does not fail the request (this test failed as expected with the guard removed); `disabled` is set in production.
- packages/devtools/src/__tests__/devtools.test.tsx: service and scope rendering; disabled state.

Docs follow-up for task 6: plain Layers passed to the runtime produce only app/request events.

baseline: green
Tier: implementer tier, project routing block (opus at medium)
stage: impl-review - skipped(policy: parallel-wave - conductor owns the gate)

stage: impl-review - ran (codex fan-out NEEDS_WORK -> re-review -> SHIP)
stage: plan-sync - skipped(empty: conductor edited downstream task notes directly)
## Evidence
- Commits: 47645f8, 89371b0, 4f92575
- Tests: pnpm typecheck && pnpm test, pnpm --filter showcase build && pnpm --filter showcase test
- PRs: