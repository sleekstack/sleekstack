---
satisfies: [R6]
---
# fn-18-resumable-rendering-spike-for.3 analyze: resume tree root, NonResumableHandler and handler requirements

Touches: [packages/analyze/src/components.ts, packages/analyze/src/model.ts, packages/analyze/src/__tests__/**]

## Description
Teach the Analyzer's component pass about `resume` (R6): a second tree root next to `mount`, `NonResumableHandler` for handlers it cannot prove resumable, and the existing `MissingDependency` for a handler whose requirements the `resume` layer does not provide.

**Size:** M
**Files:** `packages/analyze/src/components.ts`, `packages/analyze/src/model.ts`, `packages/analyze/src/__tests__/components.test.ts`, new fixtures `packages/analyze/src/__tests__/fixtures/ui-resumable/` (errors, with `// @error Code` markers) and a clean resume fixture (extend `ui-clean` or add `ui-resume-clean`).
**Touches:** [packages/analyze/src/components.ts, packages/analyze/src/model.ts, packages/analyze/src/__tests__/**]

### Approach
- Tree roots are found from `calleeOf(n) === 'ui/dom#mount'` with the layer read from the call's `layer` property (`components.ts:231-247`); add `ui/resume#resume` the same way, reading the `layer` and the `handlers` map.
- For each map entry read `R` from the awaited `default` type of the loader's return type; feed it to the same missing-requirement check as `check()` (`components.ts:262-291`). A loader type that cannot be read reports `NonResumableHandler` (fail closed).
- For each `on(...)` entry (server tree) require a reference to a top-level `defineHandler` call with a string-literal id; inline functions, computed ids, loop-built handlers report `NonResumableHandler` at file:line. Codes are plain string literals pushed as `{ code, message, file, line }`; `AnalyzeError.code` is `string` (`model.ts:21-22`) and the UiNode union is at `model.ts:118-125`.
- Reuse the existing handling of yields inside `Effect.all` and nested guest props for the new root (memory: analyzer-component-pass-skipped).
- Fixtures follow `components.test.ts:18-33` (`it.each` over fixture names with `// @error` markers, plus a clean assertion).
- The code reaches the CLI generically (`packages/cli/src/check.ts:71`); no CLI change.

### Investigation targets
**Required** (read before coding):
- `packages/analyze/src/components.ts:22-24,231-291` — tree roots, `fail()`, `check()`
- `packages/analyze/src/model.ts:21-22,118-125` — error type and UiNode
- `packages/analyze/src/__tests__/components.test.ts:18-33` — fixture test pattern
- `packages/ui/src/handler.ts` and `packages/ui/src/resume.ts` — the API surface the pass reads (from tasks 1 and 2)

**Optional** (reference as needed):
- `packages/analyze/src/__tests__/fixtures/ui-missing/` — an existing error fixture to copy the layout from

### Acceptance
- [ ] `NonResumableHandler` reported with file:line for: inline function, non-literal id, handler not at top level / built in a loop, unreadable loader type
- [ ] `MissingDependency` reported for a handler whose `R` the `resume` layer lacks; clean fixture reports nothing
- [ ] Yields inside `Effect.all` and nested guest props covered by a fixture case
- [ ] `apps/ui-demo` Analyzer-clean test still passes; `pnpm --filter @sleekstack/analyze test` and typecheck pass

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
