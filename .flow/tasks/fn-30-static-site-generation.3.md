---
satisfies: [R2, R5]
---
# fn-30-static-site-generation.3 Example app prerender, hydration and static-serve test, docs

## Description
Enable prerender in the example app, prove hydration and static serving, and document the option.

**Size:** M
**Files:** example app vite config and routes (ui-demo equivalent, or new example), its test, packages/ui-vite/README.md
**Touches:** [packages/ui-vite/README.md, packages/ui-vite/src/__tests__/**, the example app dir]

### Approach
- Build the example, serve `dist` with a plain static file server in a test, fetch each prerendered path.
- Hydrate a prerendered page (pattern: `packages/ui/src/__tests__/hydrate.test.ts`) and assert no `HydrationMismatch`.
- Document `prerender` option, route `prerender()`, trailing-slash policy.

### Investigation targets
**Required**:
- `packages/ui/src/hydrate.ts`
- `packages/ui/src/__tests__/hydrate.test.ts`

## Acceptance
- [ ] Prerendered page hydrates without HydrationMismatch (R2)
- [ ] Built output served from a static file server returns correct pages in a test (R5)
- [ ] README documents the options
- [ ] `pnpm turbo run test build --filter=@sleekstack/ui-vite...` passes

## Done summary
Example app: apps/playground/ui (the sleekstack() app; no apps/ui-demo exists) now builds with `prerender: true`; `users/[id]` expands from `prerender()` to /users/42; the server entry exports `router`, passes `{ onError }` to `handle`, and renders to a string with `document.before(head)`, so pages carry their `<Head>` titles. apps/playground/src/__tests__/ui-example.test.ts builds, serves dist/client from a plain node:http static server, fetches `/`, `/users/42`, `/users/42/` (404 for an unprerendered path), and hydrates the prerendered home asserting no console.error (the entry's onError), so no HydrationMismatch (confirmed red against a tampered page). packages/ui-vite/README.md gains a "Prerendering: `prerender`" section (option, route `prerender()`, trailing-slash policy, server-entry contract).

Review fix (outside declared Touches, flagged): packages/router/src/loader.ts `keyOf` drops a trailing slash, so a prerendered page opened at `/a/` hydrates from the server's loader results instead of rerunning them (test in packages/router/src/__tests__/navigation.test.ts, red first).

Follow-ups: packages/ui-vite/README.md line 21 still says the playground streams, and "Known limitations" still says there is no SSG for sleekstack() apps; left unedited per the conductor's new-section-only README rule.

Gates: baseline green (quick command). Verify: `pnpm turbo run test build --filter=@sleekstack/ui-vite...` green (one earlier run hit the known flaky plugin.test.ts SearchIndexMissing, inherited, untouched); `pnpm turbo run test typecheck --filter=sleekstack-playground --filter=@sleekstack/router...` green.

Tier: implementer: opus at medium
stage: impl-review - ran (codex fan-out --base master: round 1 integration NEEDS_WORK, trailing-slash loader rehydration; fixed; finalize refunded on head change, re-dispatched fan-out 3/3 SHIP)
## Evidence
- Commits: 9cf52d8ac0b9c6bed19cf7ff7aed1b7e007cc7a7, 007448b3f1c372cf4b8c82292440f26d58d5d9cd
- Tests: pnpm turbo run test build --filter=@sleekstack/ui-vite..., pnpm turbo run test typecheck --filter=sleekstack-playground --filter=@sleekstack/router...
- PRs: