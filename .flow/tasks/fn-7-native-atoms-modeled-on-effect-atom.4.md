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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
