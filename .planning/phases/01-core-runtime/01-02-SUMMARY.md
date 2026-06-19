---
phase: 01-core-runtime
plan: "02"
subsystem: core-module-api
tags: [module, cycle-detection, DFS, effect, TypeScript, CORE-01, CORE-02, CORE-04, wave-2]
dependency_graph:
  requires: [01-01]
  provides: [core-module-function, core-types, cycle-detection]
  affects: [packages/core]
tech_stack:
  added: []
  patterns: [DFS-visiting-set, pure-data-module, effect-type-imports-only, prototype-pollution-guard]
key_files:
  created:
    - packages/core/src/cycle.ts
  modified:
    - packages/core/src/types.d.ts
    - packages/core/src/index.ts
decisions:
  - "detectCycles accepts {name, imports} shape (not Module's {_name, _imports}) to keep cycle.ts independent of the full Module type; module() maps via toDetectShape() adapter before calling detectCycles"
  - "name validation uses typeof guard and trim() to reject non-string, empty, and whitespace-only names; never used as object key (T-02-01 prototype-pollution prevention)"
  - "Module value is a plain object (not frozen) — Object.freeze was considered but deferred since tests do not require it and it complicates downstream assignment in tests"
metrics:
  duration: "~2 minutes"
  completed_date: "2026-06-20"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
status: complete
---

# Phase 01 Plan 02: Core module() API Summary

Implemented `@sleekstack/core` from scratch: `module()` function, `Module<Exports>` type, and internal DFS circular-dependency detection. The prototype API (`createService`, `layer`, `EffectLib`, `ServiceProvider*`, etc.) is fully removed. CORE-01, CORE-02, and CORE-04 tests are green; typecheck is clean.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement DFS circular-dependency detection in cycle.ts | 6b4324e | packages/core/src/cycle.ts (created) |
| 2 | Rewrite core types.d.ts and implement module() in index.ts | c524ab2 | packages/core/src/types.d.ts, packages/core/src/index.ts |

## What Was Built

### Task 1: cycle.ts — DFS Circular-Dependency Detection

Created `packages/core/src/cycle.ts` (internal, not in public barrel).

`detectCycles(mod)` runs a depth-first traversal using a `visiting` Set that tracks names currently on the recursion stack. When a name already in `visiting` is encountered, it computes the cycle slice from the first occurrence in `path`, appends the repeated name, joins with ` -> `, and throws:

```
Circular module dependency detected: ModuleA -> ModuleB -> ModuleA
```

Diamond imports (A imports B and C, both import D) do NOT trigger a false positive — a node re-visited from a different path is NOT in `visiting`.

Time complexity: O(V+E). The visiting-set bound guarantees termination (T-02-02).

### Task 2: types.d.ts + index.ts — module() and Module type

**types.d.ts rewrite:**
- Removed: `Service`, `ServiceInit`, `ServiceFactory`, `ServiceProviderGenerator`, `ServiceProvider`, `ServiceProviderObject`, `createService`, `createServiceProvider`, `EffectLib` re-export
- Added: `Module<Exports extends Context.Tag<any, any> = never>` type with `_name`, `_layers`, `_imports`, `_exports` fields; `module<E>()` declaration

**index.ts rewrite:**
- Removed: `import * as Effect from 'effect'`, `createService`, `layer`, `EffectLib`, `ServiceTag`, `LayerLike`
- Added: `module()` implementation with:
  1. Name validation: `typeof name !== 'string' || name.trim().length === 0` throws (T-02-01)
  2. Module value construction: `{ _name, _layers, _imports: imports ?? [], _exports: exports ?? [] }`
  3. Cycle detection adapter: maps Module to `{name, imports}` shape before calling `detectCycles`
  4. Returns the assembled Module value
- Exports: only `module` (function) and `Module` (re-exported type)

## Verification Results

```
CORE-01 — module.test.ts (8 tests): PASS
CORE-02 — cycle.test.ts (5 tests): PASS
CORE-04 — module.test.ts (3 tests): PASS
Total: 13 tests passed, 0 failed
typecheck (tsc --noEmit): PASS
grep prototype API: only in comments, no active code
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added toDetectShape() adapter to bridge Module and ModuleConfig shapes**
- **Found during:** Task 1 verification (cycle tests failing after both tasks were implemented)
- **Issue:** `detectCycles` expects `{ name: string; imports?: ... }` but `module()` creates `{ _name, _imports, ... }`. Passing `mod` directly to `detectCycles` caused all cycle tests to fail because the DFS checked `mod.name` (undefined) instead of `mod._name`.
- **Fix:** Added `toDetectShape()` internal adapter in `index.ts` that maps `Module` → `{ name, imports }` shape before calling `detectCycles`. `cycle.ts` stays independent of the full Module type (no `_name`/`_imports` field coupling).
- **Files modified:** `packages/core/src/index.ts`
- **Commit:** c524ab2

## Known Stubs

None — all fields are wired to real data. `module()` returns a fully populated Module value.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All changes are pure library code (TypeScript module + in-memory data structures). No threat flags.

## Self-Check: PASSED

All files found on disk and commits verified in git log (6b4324e, c524ab2).
