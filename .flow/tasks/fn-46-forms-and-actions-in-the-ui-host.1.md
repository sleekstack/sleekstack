---
satisfies: [R1, R9, R10, R11, R12, R13, R14, R16]
---
# fn-46-forms-and-actions-in-the-ui-host.1 FormData in events and the action prop

## Description
FormData in events and the action prop. Contract and rationale are in the parent spec (R-IDs above).

**Size:** M
**Files:** packages/ui/src/handler.ts (HandlerEvent), jsx-runtime.ts (split), dom.ts (handled, dispatch, listen), resume.ts (snapshot, delegated listener)
**Touches:** [packages/ui/src/handler.ts, packages/ui/src/jsx-runtime.ts, packages/ui/src/dom.ts, packages/ui/src/resume.ts, tests]

### Approach
- Map `action` on a form to a submit binding run through `handled()`; add a `formData` field to the event passed to actions on both paths (closures get the raw event today, defineHandler/resume the HandlerEvent snapshot): build `new FormData(form, submitter)` at dispatch.
- Always preventDefault when `action` is set; `onSubmit` first; latest run wins (interrupt the previous fiber in `ev.fibers`); a Promise result raises a clear TypeError.
- Never emit FormData in the manifest (server side untouched).

## Acceptance
- [ ] Function, generator and Effect actions run with FormData on submit (R1)
- [ ] Closure and resumed paths give the same value; no FormData in the manifest (R9, R10)
- [ ] Submitter included; Promise result rejected; double submit interrupts; default prevented, onSubmit first (R11, R12, R13, R14)
- [ ] No automatic form reset (R16)


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
