## Goal & Context
<!-- scope: business -->

Static sites should prerender routes to HTML at build time. SSG is a build mode over the SSR path, not a new renderer.

## Architecture & Data Models
<!-- scope: technical -->

- Vite plugin build step: enumerate routes, render each through the SSR entry, write `index.html` per path, emit the client bundle for hydration.
- **One prerender source:** the plugin option `prerender: true | string[]` lists/enables routes; a route's own `prerender()` supplies param values for that route. The option is the switch, the route function expands dynamic params; the two are merged as a union.
- Loaders run at build time; data is serialized as in SSR (fn-25 format). Title/meta come from head management (fn-33).
- First user: `apps/ui-demo` or a new example app. `apps/docs` is Next/fumadocs and is not moved.

## API Contracts
<!-- scope: technical -->

Plugin option `prerender`; route option `prerender(): Promise<Array<Params>>`.

## Edge Cases & Constraints
<!-- scope: technical -->

A route failing at build fails the build with its path; dynamic params without `prerender()` are skipped with a warning; trailing-slash policy is one documented choice.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `vite build` writes an HTML file per prerendered route with rendered content and head tags. Errors: none beyond R3.
- **R2:** A prerendered page hydrates without `HydrationMismatch`.
- **R3:** A loader or render error fails the build naming the route.
- **R4:** Dynamic routes prerender from `prerender()`; one without it is skipped with a warning.
- **R5:** The example app's build output serves correctly from a static file server in a test.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test build --filter=@sleekstack/ui-vite...`

## Boundaries
<!-- scope: business -->

No ISR, no incremental builds, no deploy adapters, no docs-site migration.

## Decision Context
<!-- scope: both -->

Depends on fn-29, fn-50 (`@sleekstack/router` loaders, absorbed fn-32) and fn-33 (head must land first so prerendered pages have titles).
