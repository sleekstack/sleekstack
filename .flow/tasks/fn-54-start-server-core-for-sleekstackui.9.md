---
satisfies: [R1, R2]
---
# fn-54-start-server-core-for-sleekstackui.9 close the completion-review gaps: notFound requires Route, pages run in the request runtime

## Description
The spec completion review (Codex, NEEDS_WORK) found two real gaps that earlier task summaries and ADR 0039 had recorded as known limitations. Both contradict a requirement, so they are fixed here.

**Size:** M
**Files:** packages/router/src/resolve.ts, history.ts, server.ts; packages/start/src/start.ts; packages/ui/src/string.ts and stream.ts only if a render option is needed; type tests in packages/router/src/__tests__/; tests in packages/start/src/__tests__/; docs/adr/0039-*.md (known gaps section)
**Touches:** [packages/router/src/**, packages/start/src/**, packages/ui/src/**, docs/adr/0039-*.md]

### Approach
- R1: a `notFound` page runs where no route matched, so the router does not provide `Route` to it. Track the not-found page's requirements apart from matched pages' (or exclude `Route` only for matched pages) so `startRouter` and `handle` require a layer that provides `Route` when the not-found page needs it; the analyzer already reports this case (task .7), keep both consistent. Add a type test: a `notFound` page that needs `Route` fails to compile without it in the layer.
- R2: pages are rendered by the router's `handle` on its own Effect runtime, so the request fiber's runtime state (FiberRefs, tracer, logger, devtools scope) is lost. Give `handle` a way to run inside the caller's runtime (for example an optional runtime captured with the Effect runtime accessor in the request fiber and used for the loader and render runs). Keep the router default unchanged when none is passed. Prefer the smallest change; if ui's render functions must accept a runtime or context, make that change small and additive, and say so in the summary.
- Add a test in `start` showing a FiberRef or tracer set in the request scope is visible to a page render and to a loader.
- Update ADR 0039's known-gaps section to remove the two gaps that this fixes.
- Equivalence pin: all existing router, start, ui and showcase tests pass unchanged.

### Investigation targets
**Required**:
- `packages/router/src/resolve.ts` (`RouterProvided`, `Router`, `resolve`), `server.ts` (`handle`, `Effect.runPromiseExit`), `history.ts`
- `packages/start/src/start.ts` (router stage near the `Effect.promise` call)
- `packages/ui/src/string.ts`, `stream.ts` (how `layer` becomes a runtime or scope)
- the two review findings: R1 `RouterProvided` still includes `Route`; R2 the router stage in `start.ts`
**Optional**:
- `.flow/tmp/handover/fn-54.2.summary.md`, `fn-54.7.summary.md`
- `docs/adr/0039-start-server-core.md`

## Acceptance
- [ ] A `notFound` page needing `Route` fails type checking when the entry layer lacks `Route` and compiles when it provides it; a matched page needing `Route` still compiles without it
- [ ] A test shows a FiberRef set in the request scope is visible inside a page render and inside a loader run through `start(...).fetch`
- [ ] `handle` without a passed runtime behaves exactly as before; existing router, ui, start and showcase tests pass unchanged
- [ ] ADR 0039 no longer lists these two gaps as open
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/router... --filter=@sleekstack/start... --filter=@sleekstack/ui... --filter=showcase` is green

## Done summary
R1: `RouterProvided` is now `Loaders | Transfer | Store`. `router()` drops `Route` from what matched pages and their loaders need, but keeps it in what `notFound` needs. So `startRouter`, `handle` and `start` need a layer that provides `Route` when the not-found page reads it, which matches the analyzer (task .7). `start`'s `Needs` no longer excludes `Route`. Type tests: `packages/router/src/__tests__/requirements.test-d.ts` (a `notFound` needing `Route` fails without it and compiles with it; matched `params` pages still compile without it, via `free`) and `packages/start/src/__tests__/layer.test-d.ts`. The test was run red first against the old resolve.ts (TS2578 unused expect-error).

R2: `handle` takes an optional `runtime` and runs `resolve` (the loaders) and the string and stream renders on it. Without one it uses `Runtime.defaultRuntime`, the same as before. `start`'s page stage now passes the request fiber's `Effect.runtime()` instead of `Layer.succeedContext(context)`. The ui change is small and additive: `runToNode` takes `{ onError, runtime }` (in place of the positional `onError`; dom.ts is its other caller, updated); `renderToString` options and `StreamOptions` extend a new internal `RunOptions` (`onError`, `runtime`); the stream shell and boundary reruns fork on that runtime. Test: `start.test.ts` "a page loader and render run in the request fiber, seeing its FiberRefs". A middleware sets a FiberRef, and the loader and the render both read it through `start(...).fetch`. It was red before the fix (`unset unset`).

ADR 0039: both gaps are gone from Known gaps, and two Consequences lines record the new behavior.

Follow-up: `renderToStream`'s `late()` not-found render and the `stream` path are now covered by the runtime, but no test pins the stream path with a runtime (start does not stream).

baseline: green
stage: impl-review - ran (codex fan-out round 1, all three draws SHIP, --base master)
Tier: implementer opus at medium
## Evidence
- Commits: 7e453a36661b6d087bcd6dc9fe28b17a93b56fe0
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/router... --filter=@sleekstack/start... --filter=@sleekstack/ui... --filter=showcase
- PRs: