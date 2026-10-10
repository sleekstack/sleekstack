---
satisfies: [R9, R10, R11, R15]
---
# fn-50-sleekstackrouter.5 Redirect, not-found, server handler and history

## Description
Redirect, not-found, server handler and history. Contract and rationale are in the parent spec (R-IDs above).

**Size:** M
**Files:** packages/router/src/server.ts, history.ts; follow packages/next/src/runtime.ts (control-flow passthrough for redirect/notFound)
**Touches:** [packages/router/src/**, tests]

### Approach
- Redirect and not-found as control flow in all renderers; `handle(request)` returns a Response; back/forward and scroll restoration; latest navigation wins.
- Loader transfer state is `{loaders, rest}`, carried by `LoaderTransferLive` through `@sleekstack/ui`'s Transfer (a required peer of @sleekstack/router); server handler must compose it.
- The client never reloads a loader for the same pathname today; this task owns reload-on-navigation. Readers of one loader+pathname share a load that stops with the last reader, so interrupting a navigation closes it.
<!-- Updated by plan-sync: fn-50-sleekstackrouter.3 transfer shape {loaders, rest}, ui peer, no reload on same pathname, shared load -->

## Acceptance
- [ ] Redirect and not-found behave as control flow (R9)
- [ ] Server entry returns page, redirect or not-found responses (R10)
- [ ] History and scroll restoration work; latest navigation wins and the interrupted loader's scopes close with no leaked observers (R11)
- [ ] A server loader failure responds with the error status; a redirect loop past a fixed bound fails with a tagged error (R15)


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
