---
satisfies: [R2, R3, R4, R5, R15, R17]
---
# fn-46-forms-and-actions-in-the-ui-host.2 Status, result and optimistic atoms

## Description
Status, result and optimistic atoms. Contract and rationale are in the parent spec (R-IDs above).

**Size:** M
**Files:** packages/ui/src/reactive.ts (new hooks following useDerivedAtom/useRef slot pattern), index.ts exports, tests
**Touches:** [packages/ui/src/reactive.ts, packages/ui/src/index.ts, packages/ui/src/__tests__/form-*.test.ts]

### Approach
- Per-form `Result` atom (`Result.waitingFrom` keeps the last value), `useFormStatus` as a derived atom of it, optimistic value as a derived atom over (source, pending change) with revert on failure/settle (fn-36.D2).
- Decode FormData with Effect `Schema.decodeUnknown` on `Object.fromEntries`; failures land in the Result as typed failures (fn-36.D4).
- Export the action and Result types (ADR 0019 name check); new slot hooks must be added to the analyzer list, which `slotHooks.test.ts` keeps in sync.

## Acceptance
- [ ] Status reports pending while running and settles after (R2)
- [ ] Result atom initial/waiting/success/failure (R3)
- [ ] Optimistic value shows then reverts on failure or settle, before rollback (R4, R15)
- [ ] Schema decode failure is a typed failure (R5)
- [ ] Types exported for the router (R17)


## Done summary
`useAction(run)` returns `[result, action]` with a per-form `Result` atom (waitingFrom keeps the last value; only the latest run settles; failures, including Schema `ParseError`, stay in the Result), `useFormStatus(result)` reads a derived `{ pending }` atom, and `useOptimistic(source, apply)` layers pending changes over the (current) source and drops each when its effect ends, before the Result is set. `FormAction` (prop type) and `BoundAction`/`Result` types are exported; analyzer checks the new slot hooks; ADR 0033 and the ui README extended. Review also surfaced a renderer bug (re-run closed a Provider layer a running handler used): handler fibers now hold their run scope (LazyScope.hold). Tests: packages/ui/src/__tests__/form-state.test.ts.

stage: impl-review - ran (codex fan-out NEEDS_WORK -> re-review SHIP)
Tier: implementer opus at medium
## Evidence
- Commits: 3dd0f44b3301cb98f717364277f0653e96c19df3, 3cb53b8080fdb5c08e1f5da507290ba790143c4f, c7afa4cabf4ae2c1f50e271c244f8f912e2d32fc, 9de026825a6b04bbef5eda79c3e10084fec71c97
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=@sleekstack/analyze --filter=docs
- PRs: