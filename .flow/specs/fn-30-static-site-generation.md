## Goal & Context
<!-- scope: business -->

Static sites (docs, marketing) should prerender routes to HTML at build time. SSG is a build mode over the SSR path, not a new renderer.

## Architecture & Data Models
<!-- scope: technical -->

- Vite plugin build step: enumerate routes (static ones, plus ones a route's `prerender()` returns), render each with the SSR entry, write `index.html` per path, emit the client bundle for hydration.
- Loaders run at build time; their data is serialized the same way as in SSR.
- `apps/docs` is the candidate first user (check how it builds today before deciding whether to move it; it may stay as is).

## API Contracts
<!-- scope: technical -->

Plugin option `prerender: true | string[] | () => Promise<string[]>`.

## Edge Cases & Constraints
<!-- scope: technical -->

A route failing at build fails the build with the route path; dynamic params without `prerender()` are skipped with a warning; trailing-slash policy.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `vite build` writes an HTML file per prerendered route containing the rendered content.
- **R2:** Loading a prerendered page hydrates without mismatch.
- **R3:** A loader error fails the build naming the route.
- **R4:** Dynamic routes prerender from `prerender()`.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test build --filter=@sleekstack/ui-vite...`

## Boundaries
<!-- scope: business -->

No ISR, no incremental builds, no deploy adapters.

## Decision Context
<!-- scope: both -->

Last in the order; depends on the Vite plugin.
