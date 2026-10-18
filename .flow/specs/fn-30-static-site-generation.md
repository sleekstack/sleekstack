## Goal & Context
<!-- scope: business -->

Mostly delivered by fn-59 (ADR 0043). `sleekContent({ prerender: { server, client } })` makes `vite build` write `<route>/index.html` per page with rendered content, head tags (`Head`, ADR 0042), the stylesheet and the hydrating client script, plus `search-index.json` and Open Graph images. A page failing to compile or render fails the build as `prerender /route: reason`; the output is plain files that need no server logic.

What is left is generic prerender for apps that are not content sites.

## Architecture & Data Models
<!-- scope: technical -->

- **Left:** the `prerender: true | string[]` option and a route's own `prerender()` supplying params for dynamic routes (merged as a union); a dynamic route without `prerender()` is skipped with a warning; loaders run at build time and serialize as in SSR; one documented trailing-slash policy.
- Prerender today enumerates content pages only (every page route), from the route table.

## Acceptance Criteria
<!-- scope: both -->

- **R2:** A prerendered app page hydrates without `HydrationMismatch` (content pages: covered by fn-59).
- **R3:** A loader error fails the build naming the route (render errors: covered by fn-59).
- **R4:** Dynamic routes prerender from `prerender()`; one without it is skipped with a warning.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test build --filter=@sleekstack/ui-vite...`

## Boundaries
<!-- scope: business -->

No ISR, no incremental builds, no deploy adapters.

## Decision Context
<!-- scope: both -->

Depends on fn-29 (remaining part) and fn-50. fn-33 landed in fn-59, so prerendered pages have titles.
