## Goal & Context
<!-- scope: business -->

Apps wire JSX config and the analyzer by hand. A SleekStack Vite plugin gives one setup line: JSX for ui files, analyzer diagnostics, file-based routes feeding `@sleekstack/router`, SSR/client entries, and stable component ids (needed by HMR, fn-31). Own plugin, not a meta-framework.

## Architecture & Data Models
<!-- scope: technical -->

- New package `packages/ui-vite` (task 1 checks Vite's current plugin and environment API).
- **JSX stays opt-in per file** (ADR 0015: ui JSX uses a pragma; guest files use React JSX and ui-demo uses `@vitejs/plugin-react`). The plugin does not set a global `jsxImportSource`; it either relies on the pragma or accepts include/exclude globs, and coexists with plugin-react for guests.
- **Analyzer:** whole-program TypeScript analysis, so it runs debounced on change and always on build; a failure never crashes the dev server (reported in the overlay). Reuses `@sleekstack/analyze`.
- **Routes:** no TanStack generator (ADR 0036). Route files are turned into a `@sleekstack/router` const route table; params stay inferred from path strings.
- **Stable ids:** a transform assigns each component function a stable id from file path + export name, consumed by `fnId` in `reactive.ts` (falls back to the counter without the plugin). This enables fn-31.
- **SSR:** dev and build render through `renderToStream` (fn-27).

## API Contracts
<!-- scope: technical -->

`sleekstack(options?: { include?; exclude?; routesDir?; entries? })`.

## Edge Cases & Constraints
<!-- scope: technical -->

Route file add/rename/delete updates the tree; analyzer crash isolated; client and SSR bundles both build; the id transform is deterministic and survives re-export.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** A Vite project with `sleekstack()` compiles pragma'd ui TSX and React guest TSX side by side. Errors: a file with neither pragma nor include match is left to the default.
- **R2:** An analyzer error shows in the overlay with file:line and clears when fixed. Errors: an analyzer crash is reported, not thrown.
- **R3:** Route files produce a route tree consumed by `@sleekstack/router`, updating on add/remove without restart. Errors: an invalid route file reports its path.
- **R4:** `vite build` yields client and SSR bundles that render and hydrate an example app.
- **R5:** Component ids are stable across a module re-evaluation in a test; without the plugin, ids still work. Errors: duplicate id from two files fails the build.
- **R6:** ui-demo or a new example runs on the plugin.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck build --filter=@sleekstack/ui-vite...`

## Boundaries
<!-- scope: business -->

No HMR state preservation (fn-31), no SSG (fn-30), no deploy adapters.

## Decision Context
<!-- scope: both -->

Depends on fn-27 and fn-50 (`@sleekstack/router`, which absorbed fn-28 and fn-32).
