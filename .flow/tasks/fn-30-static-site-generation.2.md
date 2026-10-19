---
satisfies: [R1, R3]
---
# fn-30-static-site-generation.2 Build-time render and write HTML per route

## Description
In the plugin's build step, render each enumerated path through the SSR entry, run loaders, serialize state, include head tags, write `<path>/index.html`, and emit the client bundle for hydration.

**Size:** M
**Files:** packages/ui-vite/src/prerender/build.ts, packages/ui-vite/src/index.ts (closeBundle/build hook), packages/ui-vite/src/prerender/__tests__/build.test.ts
**Touches:** [packages/ui-vite/src/prerender/**, packages/ui-vite/src/index.ts]

### Approach
- Reuse the SSR path (`renderToStream`, fn-27) and `handle` in `packages/router/src/server.ts:60`; collect the stream to a string per path.
- Loader data serialized with the fn-25 state payload (`packages/ui/src/transfer.ts`); head tags from fn-33 head management.
- Any render or loader error rejects the build with the route path in the message.

### Investigation targets
**Required**:
- `packages/router/src/server.ts`
- `packages/ui/src/stream.ts`, `packages/ui/src/transfer.ts`

### Key context
Depends on fn-29 (plugin SSR/client entries) and fn-33 (head API); API names unknown until they land.

## Acceptance
- [ ] `vite build` writes one HTML file per prerendered path with rendered content and head tags (R1)
- [ ] Loader or render failure fails the build naming the route (R3)
- [ ] Tests for success and failing-route cases

## Done summary
`vite build` with `prerender` requests each enumerated path from the built server entry (which exports its `router` and takes `(request, { onError })`) and writes `<path>/index.html` to the client output; a throw, a non-200, or an `onError` report fails the build naming the route, and a path that maps unsafely (encoded separator, `.`/`..`, two paths to one file) is rejected. Touches widened by the conductor to packages/router/src/server.ts: `handle`'s `document.before` may be `(head) => string`, so page `<Head>` tags land in the written head (string render; a streamed page's tags arrive as a late patch).

Tests: packages/ui-vite/src/prerender/__tests__/build.test.ts (R1 head/content/loader data; R3 loader, render, encoded-separator failures); packages/router/src/__tests__/navigation.test.ts (Head in string and stream modes).

Gates: baseline red (pnpm turbo run test build --filter=@sleekstack/ui-vite... failed pre-edit on plugin.test.ts "serves the build-format search index" - SearchIndexMissing fetch failed, known env issue, same at verify; no receipt). Router gate `pnpm turbo run test typecheck --filter=@sleekstack/router...` green. Focused prerender tests and typecheck green.

Follow-ups: apps/playground/ui entry needs a `router` export and `onError` pass-through for prerender (task .3).

Tier: implementer: opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK, 2 findings: Head tags dropped, encoded-separator file collision; both fixed, re-review SHIP)
## Evidence
- Commits: a319fd4ceb284e50d7a740e9b26063e9714b9c23, 4bf4db55957ba58fe9ac3c9873f420cdc5a14962, 3d933573dbce23aca74b13ffb2f18a9fa44b6d87
- Tests: pnpm turbo run test build --filter=@sleekstack/ui-vite... (1 inherited env failure: plugin.test.ts search index fetch failed), pnpm turbo run test typecheck --filter=@sleekstack/router..., npx vitest run src/prerender (packages/ui-vite)
- PRs: