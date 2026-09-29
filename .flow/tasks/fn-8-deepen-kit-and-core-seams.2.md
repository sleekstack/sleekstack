---
satisfies: [R6]
---
# fn-8-deepen-kit-and-core-seams.2 Typed action failures via an internal next Exit hook (ADR 0009)

## Description
Remove kit next's FAILED/ERRORED sentinel protocol. `@sleekstack/next` `action`/`query` get an @internal option (e.g. `onExit`/`mapExit`) letting a wrapper receive the operation's Exit and decide resolve/reject, keeping the stream guard and public behavior. kit's lowering maps one Exit to ActionResult / HandlerFailed / query rejection. Add ADR 0009 (next exposes an internal Exit hook for adapters) and index it.

Touches: packages/next/src/action.ts, packages/next/src/__tests__/**, packages/kit/src/next/action.ts, packages/kit/src/__tests__/next.test.ts, docs/adr/0009-*.md, docs/adr/README.md

## Acceptance
- [ ] No sentinel symbols in kit next; existing kit next tests pass unchanged; a new test shows a handler returning an object shaped like the old sentinel is returned as data.
- [ ] @sleekstack/next public tests unchanged and passing; the internal hook is @internal (not in the public reference).
- [ ] ADR 0009 exists and is indexed; docs test passes.


## Done summary
`@sleekstack/next` action/query take an @internal `onExit` hook; kit's next lowering maps one Exit to ActionResult / HandlerFailed / query rejection, the FAILED/ERRORED sentinels and normalize's next-envelope unwrap are deleted, and ADR 0009 is added and indexed. The docs API generator now sets `excludeInternal: true` so the hook stays out of the reference. Tests: kit next.test.ts (sentinel-shaped data returned as data; user Error with Cause -> HandlerFailed), next.test.ts (onExit hook), errors.test.ts row updated.

stage: impl-review - ran (codex fan-out 3x SHIP)
## Evidence
- Commits: e7ca4a4c2ae1ee642a27a05d3a34b655597100f4
- Tests: pnpm typecheck && pnpm test --force, pnpm --filter docs build && pnpm --filter docs test
- PRs: