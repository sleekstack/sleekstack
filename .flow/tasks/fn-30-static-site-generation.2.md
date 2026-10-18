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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
