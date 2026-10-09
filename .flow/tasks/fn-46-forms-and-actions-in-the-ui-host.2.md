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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
