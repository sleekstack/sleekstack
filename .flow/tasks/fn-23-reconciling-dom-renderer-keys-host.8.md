---
satisfies: [R8]
---
# fn-23-reconciling-dom-renderer-keys-host.8 analyze: ConditionalSlot and MissingKey rules, error table and llms.md

Touches: packages/analyze/src/components.ts, packages/analyze/src/errorCodes.ts, packages/kit/llms.md, packages/analyze/src/__tests__/components.test.ts, packages/analyze/src/__tests__/fixtures/**

## Description
Two standalone per-call component-pass rules (spec API Contracts: new Analyzer codes). Runs in parallel with the DOM tasks once the types exist.

**Size:** M
**Files:** `packages/analyze/src/components.ts`, `packages/analyze/src/errorCodes.ts`, `packages/kit/llms.md`, tests and fixtures under `packages/analyze/src/__tests__/`
**Touches:** [packages/analyze/src/components.ts, packages/analyze/src/errorCodes.ts, packages/kit/llms.md, packages/analyze/src/__tests__/**]

### Approach
- Model both on the `checkOn` standalone rule in `visit()` (pushes onto a separate error array merged at the end): they are not tree-position dependent.
- `ConditionalSlot`: a `useLocal` call (identify with `calleeOf(call) === 'ui/reactive#useLocal'`) that is not at the top level of a component body: inside a condition, loop, nested function or helper function, after an early `return`, or (in `Effect.gen`) after the first conditional `return`. Anything unprovable is an error (fail closed).
- `MissingKey`: a `.map` / `.flatMap` / `Array.from` callback in a child position (including inside `Effect.all` lists and spread arrays; the memory entry on skipped `Effect.all` lists and nested guest props applies) that returns an element or component without a `key` prop.
- Add both codes to the `AnalyzeCode` union and `ERROR_CODES` (`rule`, `fix`, `docs` = the `UI` anchor); regenerate `packages/kit/llms.md` with `UPDATE_LLMS=1 vitest run llms` in `packages/analyze`. `DuplicateKey` / `SlotMismatch` are runtime errors and do NOT go in this table.
- Fixtures: new dirs next to `ui-hooks` (e.g. `ui-slots`, `ui-keys`) with `// @error Code` markers and add them to the `it.each` list in `components.test.ts`. Do not edit `ui-clean` (line-number-sensitive assertions).

### Investigation targets
**Required**:
- `packages/analyze/src/components.ts:104-158,177-242,373-400` (`read`, `jsx`, `list`, `visit`)
- `packages/analyze/src/errorCodes.ts:11-43,132`
- `packages/analyze/src/__tests__/components.test.ts:19-34` and `fixtures/ui-hooks/app.ts`, `fixtures/ui-react/`
- `packages/analyze/src/__tests__/llms.test.ts`

### Acceptance
- [ ] Each code is reported with file:line on positive fixtures and absent on clean ones, including the nested/`Effect.all`/helper-function cases above.
- [ ] `errorCodes.test.ts` and `llms.test.ts` pass (llms.md regenerated and committed).
- [ ] `sleekstack check --json` lists the new codes under `components`.

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
