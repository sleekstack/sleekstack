---
satisfies: [R9, R10, R11]
---
# fn-50-sleekstackrouter.5 Redirect, not-found, server handler and history

## Description
Redirect, not-found, server handler and history. Contract and rationale are in the parent spec (R-IDs above).

**Size:** M
**Files:** packages/router/src/server.ts, history.ts; follow packages/next/src/runtime.ts (control-flow passthrough for redirect/notFound)
**Touches:** [packages/router/src/**, tests]

### Approach
- Redirect and not-found as control flow in all renderers; `handle(request)` returns a Response; back/forward and scroll restoration; latest navigation wins.

## Acceptance
- [ ] Redirect and not-found behave as control flow (R9)
- [ ] Server entry returns page, redirect or not-found responses (R10)
- [ ] History and scroll restoration work; latest navigation wins (R11)


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
