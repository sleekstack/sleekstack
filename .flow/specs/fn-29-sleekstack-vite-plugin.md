## Goal & Context
<!-- scope: business -->

Partly delivered by fn-59. `packages/ui-vite` exists: `sleekContent` compiles MDX pages with build-time highlighting, builds a `@sleekstack/router` table from a content tree (updating on add, rename and remove without a restart), checks links, and routes dev requests to the `start` handler (ADR 0043). What is left is the general app plugin: JSX setup, analyzer diagnostics, file-based routes beyond the content table, and stable component ids (needed by HMR, fn-31).

## Architecture & Data Models
<!-- scope: technical -->

- **Done (fn-59):** the package, the content route table, the dev entry, prerender (see fn-30).
- **Left:** JSX stays opt-in per file (ADR 0015), no global `jsxImportSource`, coexisting with plugin-react for guests. The analyzer runs debounced on change and always on build, reusing `@sleekstack/analyze`; a crash is reported in the overlay, never thrown. Route files beyond the content table become a const route table (ADR 0036, no generator). A transform assigns each component function a stable id from file path and export name, read by `fnId` in `reactive.ts` (counter fallback without the plugin).

## Acceptance Criteria
<!-- scope: both -->

- **R1:** A Vite project with the plugin compiles pragma'd ui TSX and React guest TSX side by side.
- **R2:** An analyzer error shows in the overlay with file:line and clears when fixed; a crash is reported, not thrown.
- **R3:** Route files produce a route tree consumed by `@sleekstack/router`, updating without restart; an invalid route file reports its path.
- **R5:** Component ids are stable across a module re-evaluation; without the plugin ids still work; a duplicate id fails the build.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck build --filter=@sleekstack/ui-vite...`

## Boundaries
<!-- scope: business -->

No HMR state preservation (fn-31), no deploy adapters.

## Decision Context
<!-- scope: both -->

Depends on fn-27 and fn-50. Delivered part: fn-59, ADR 0043. R4 (client and SSR bundles) is met for content sites by fn-59's prerender build.
