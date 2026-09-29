# Deepen kit/core seams: Tag resolution, error normalization, provide walk, typed errors, provider lifecycle, typed action failures

## Overview
Six refactors from the 2026-09-28 architecture review. Each one removes duplicated logic or a leaky seam between kit and core/next/react, and moves the tests to the module that owns the behavior. Public behavior stays the same except where noted: R4 (a type-level change) and R6 (a change to `@sleekstack/next`'s contract, recorded in an ADR).

## Quick commands
```bash
pnpm typecheck && pnpm test --force
pnpm --filter docs build && pnpm --filter docs test
```

## Scope
- **Tag resolution:** core owns privacy-aware Tag resolution (`resolveTag` / `resolveTagEffect`, which exist since fn-7). kit's `next/action.ts` (lines 73-80) replaces its inline `serviceOption` + `privateDependencyOf` with `resolveTagEffect`. There is one miss message.
- **Error normalization:** kit `normalize()` becomes the only place errors are converted. It absorbs the FiberFailure unwrap and the next-rejection `cause` unwrap. `toKit` in `react/hooks.ts` and the inline unwrap in `next/action.ts` (lines 94-97) are deleted. A table test covers `normalize` directly.
- **Provide walk:** core exposes an internal `walkProvide(provide, visit)` built on `resolveEntries`/`walkModules`. kit's `validateProvide` keeps only the `DuplicateTag` rule on top of it.
- **Typed error details:** `SleekStackError` becomes a union discriminated by `code`, with per-code `details` types mirroring core's tagged errors. The runtime is unchanged.
- **Provider lifecycle:** the `LayerProvider` scope lifecycle (park/adopt/GC timer/deferred close/atom store) moves into one internal module in `packages/react/src` with its own tests. `LayerProvider` shrinks to "get the managed scope, render the context". Add a regression test for the documented time-sliced sibling-sharing limit, asserting today's behavior so the limit is pinned.
- **Typed action failures:** `@sleekstack/next`'s `action`/`query` gain an internal Exit hook, so kit gets a typed failure instead of decoding the `FAILED`/`ERRORED` sentinel symbols. kit's lowering maps one Exit. The sentinels are deleted. ADR 0009 records the change.
- **Flaky test:** harden the showcase board test that timed out on CI ("opening task detail logs 1 acquire…"). `findByRole` gets an explicit longer timeout, or the test waits for the project to load first.

## Decisions (from plan review)
- **Canonical resolution failure (R1, R4):** every boundary produces the same tagged errors from shared core constructors, used by `useService`, the AtomStore's `wrapBuild` (`packages/core/src/atom/scope.ts`), kit next lowering and kit atoms.
  - `MissingDependency`: `{ tag: <key>, service: <requiredBy>, missing: <key> }`, message `"<requiredBy>" requires "<key>", which is not provided`.
  - `PrivateDependency`: `{ tag, module, requiredBy }` (unchanged).
  - `details.tag` is kept so existing assertions like `{ tag: 'Rq' }` still pass.
  - AtomStore failures keep their Cause structure (typed Fail, not Die).
- **Authorized behavior change:** a `useService` miss that used to throw a plain `Error` (which kit normalized to `Unknown`) now throws `MissingDependency` (kit: code `MissingDependency`). Tests asserting the old message or code are updated, and nothing else.
- **Traversal-only walk (R3):** core adds an `@internal` `walkProvide(provide, visit)`.
  - It visits each module once by identity, skipping visited modules instead of throwing on a cycle. It follows `imports` (arrays and thunks) and `provide`, and reports each Tag with its owning module.
  - It does no name checks, no shadowing and no `AmbiguousProvider`. Graph validation stays in `buildGraph` at its current boundary (invocation time), so kit's `DuplicateTag` still runs first, at definition time.
  - `walkModules` may reuse it internally.
  - Tests: DuplicateTag precedence over AmbiguousProvider, and a cycle fixture that validates at definition time and fails only at invocation, as today.

## Boundaries / non-goals
- No new public features.
- kit's public runtime behavior stays the same (except the authorized R1 change above), and every existing test passes unchanged except where a test moves to the new seam.
- No ADR is re-litigated except by adding ADR 0009 for the next contract.

## Acceptance Criteria
- **R1:** a single Tag-resolution implementation in core used by useService, kit next lowering, the AtomStore and kit atoms (grep shows no other `privateDependencyOf` call sites outside core). Errors: missing → `MissingDependency`, private → `PrivateDependency`, same message in every adapter; a core table test covers both.
- **R2:** `normalize` handles Cause, FiberFailure, next-wrapped rejection, tagged graph errors, LayerFailure and CleanupFailure. No caller pre-unwraps (no `FiberFailureCauseId` outside errors.ts). A table test in kit's `errors.test.ts` covers each envelope.
- **R3:** kit's provide validation uses core's walk. A shared fixture (nested imports, thunks, diamonds, cycles) gives the same reachable Tags from both. Errors: `DuplicateTag` is detected as today.
- **R4:** `e.code === 'X'` narrows `e.details` for every code, checked by type tests (`.test-d.ts`). The kit dts test still passes.
- **R5:** the provider lifecycle module is tested without React where possible (park/adopt/GC/close ordering). The LayerProvider, atom and StrictMode tests all pass. The sibling limit is pinned by a test.
- **R6:** kit's next lowering has no sentinel symbols. `ActionResult` behavior (ok, fail, a throw → HandlerFailed, the stream guard) is unchanged, and ADR 0009 is added and indexed. Errors: user return values can no longer collide with the internal encoding.
- **R7:** the showcase board test passes 20 times in a row locally (a loop), and no wall-clock waits under 1 s remain on async `findBy*` calls in that file.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
|-----|-------------|---------|-------------------|
| R1 | shared Tag resolution | .1 | — |
| R2 | normalize seam | .1 | — |
| R3 | shared provide walk | .3 | — |
| R4 | typed details | .4 | — |
| R5 | provider lifecycle module | .5 | — |
| R6 | typed action failures + ADR 0009 | .2 | — |
| R7 | de-flake showcase test | .6 | — |

