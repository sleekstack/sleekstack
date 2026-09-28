---
satisfies: [R5]
---
# fn-7-native-atoms-modeled-on-effect-atom.4 kit atom facade + hooks

## Description
kit facade:
- `atom(value)`, `atom(fn, deps, opts?)` and `atom.family(fn, deps)` in `packages/kit/src/atom.ts`. `fn(...services, get)` returns a value or a Promise, and a thrown or rejected result maps through `normalize`.
- `@sleekstack/kit/react` exports `useAtom`, `useAtomValue` and `useAtomSet`. They suspend on the first load and throw `SleekStackError` (with `AtomCycle` → code `AtomCycle`, added to `SleekStackErrorCode`), following the catch/rethrow-thenable/normalize shape in `kit/src/react/hooks.ts`.
- There is no `Result` or Effect in the public `.d.ts`; the dts test must pass.

Touches: packages/kit/src/atom.ts, packages/kit/src/index.ts, packages/kit/src/errors.ts, packages/kit/src/react/**, packages/kit/src/__tests__/atom*.test.ts*, packages/kit/README.md

## Acceptance
- [ ] kit atoms resolve deps like `layer`, including async factories. A missing dep throws SleekStackError `MissingDependency` to the boundary.
- [ ] Writes via `useAtomSet` re-render subscribers. Derived kit atoms (the `get` argument) recompute.
- [ ] The dts test passes with the new exports (no Result/Effect text).


## Done summary
Added kit `atom(value)`, `atom(fn, deps, opts)` and `atom.family(fn, deps)`, plus `useAtom`/`useAtomValue`/`useAtomSet` in `@sleekstack/kit/react`, with an `AtomCycle` code on SleekStackError. Every kit atom lowers to a core Result atom, so readers suspend on first load and failures (MissingDependency, PrivateDependency, AtomCycle, Unknown) reach the boundary as SleekStackError. The dts test passes. Tests: packages/kit/src/__tests__/atom.test.tsx.

Baseline: red, inherited. `react.test.tsx > StrictMode: 1 acquire / 1 release for a component Layer` fails deterministically at b792c56 (checked in a clean worktree), so the BASELINE_HANDOFF green claim was wrong. The test is outside this task's Touches and was left as is. Follow-up: fix the fn-7.3 LayerProvider regression.

stage: impl-review - ran (codex gpt-6-astra: fan-out NEEDS_WORK with 2 findings, both fixed, re-review SHIP)
Tier: opus at medium
## Evidence
- Commits: 2a02baaa4ce495297233c2f2b4ad33721c994ef5, 11af4ed3defe1cd9639b8498d4be03bda18c3f35
- Tests: pnpm typecheck, pnpm --filter @sleekstack/kit test (61/62; 1 inherited red: react.test StrictMode acquire), pnpm test
- PRs: