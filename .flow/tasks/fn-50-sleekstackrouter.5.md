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
Added redirect/not-found control flow (`redirect`, `notFound`, `RedirectLoop` past 10 redirects), `router({table, pages, notFound})`, the server entry `handle(router, request, {layer, stream, document, onError})` (200 / 302 / 404 / loader error status; a stream settles declared loaders first, then streams undeclared ones and sends their late redirect or not-found as a script) and the browser entry `startRouter` (hydrate or mount, link-click interception, back/forward and scroll restoration, reload per navigation, latest navigation wins and stops its loads, action redirect navigates). A failed loader runs once and its Boundary gets that failure. Tests: packages/router/src/__tests__/navigation.test.ts. Docs: routing guide (apps/docs/content/docs/routing.mdx + snippet), README, ADR 0036, CONTEXT.md Router entry.

baseline: green (router gate green at fn-50.4 receipt)
stage: impl-review - ran (codex fan-out NEEDS_WORK -> reload/failure replay/redirect-target/fragment/render-time control -> NEEDS_WORK stream shell -> NEEDS_WORK stream status -> SHIP)
Tier: implementer opus at medium
Follow-up: generate:api does not cover @sleekstack/router (ui packages are outside PACKAGES), so no API page.
## Evidence
- Commits: f2e86811f879b7ebda115c14a2578583de01be91, fba032e40a179a36af6b9a5b62db54e6294cde51, 65fdc87d07b39129b7b09f44f7e47685b23eb4ed, eb9ffc5fb57eef98baf7e92d4932d05b7a155c6b
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/router... --filter=docs
- PRs: