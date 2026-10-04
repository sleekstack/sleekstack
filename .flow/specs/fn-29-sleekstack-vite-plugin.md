## Goal & Context
<!-- scope: business -->

Apps today wire JSX config and the analyzer by hand. A SleekStack Vite plugin gives one setup line: JSX import source, dev-time analyzer diagnostics, file-based routes feeding `ui-router`, and an SSR entry convention. Own plugin (decision from the interview), not a meta-framework.

## Architecture & Data Models
<!-- scope: technical -->

- `packages/ui-vite` exporting a Vite plugin (check Vite's current plugin and environment API in task 1).
- Pieces: JSX defaults; analyzer run on change with errors overlaid (reuse `@sleekstack/analyze`, do not fork its logic); route-file scanning to a generated route tree; client and SSR entries.
- HMR is a separate spec; this plugin must not preclude it (expose module boundaries).
- Dev server SSR renders through `renderToStream` where available.

## API Contracts
<!-- scope: technical -->

`sleekstack()` plugin with options for routes dir and entries.

## Edge Cases & Constraints
<!-- scope: technical -->

Analyzer failure must not crash the dev server; route file rename/delete updates the tree; build output for client and server both.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** A fresh Vite project with only `sleekstack()` compiles TSX with the right JSX runtime.
- **R2:** An analyzer error appears in the dev overlay with file:line and clears when fixed.
- **R3:** Route files produce a route tree consumed by `ui-router`; add/remove updates without restart.
- **R4:** `vite build` yields client and SSR bundles that render and hydrate an example app.
- **R5:** ui-demo or a new example runs on the plugin.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck build --filter=@sleekstack/ui-vite...`

## Boundaries
<!-- scope: business -->

No HMR state preservation, no SSG, no deploy adapters.

## Decision Context
<!-- scope: both -->

Depends on the router and streaming specs.
