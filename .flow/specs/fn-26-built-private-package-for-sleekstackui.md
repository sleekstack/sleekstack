## Goal & Context
<!-- scope: business -->

`@sleekstack/ui` is consumed as TypeScript source inside the monorepo. A production framework needs a built, typed package. Per the interview it stays **private** until `apps/showcase` is ported onto it; this spec makes the build real, not published.

## Architecture & Data Models
<!-- scope: technical -->

- Build `packages/ui` (and `@sleekstack/analyze` types it needs) to `dist/` with ESM output, `.d.ts`, source maps, `exports` for `.`, `./jsx-runtime`, `./jsx-dev-runtime` and any subpath already public.
- Follow the build tooling and `exports` shape of the existing built packages (kit/react); do not introduce a new bundler (look before writing; first task records which).
- JSX config: `jsxImportSource: @sleekstack/ui` must work from `dist`.
- A consumer smoke test installs the packed tarball into a temp project and typechecks + runs a mount in jsdom.
- Fix the stray compiled output in `apps/playground/src` (untracked `.js/.d.ts` there is build residue) by pointing the playground at the built package or ignoring output.

## API Contracts
<!-- scope: technical -->

No new public API. `package.json` `exports`, `files`, `sideEffects: false`, `types`.

## Edge Cases & Constraints
<!-- scope: technical -->

Effect/React as peer dependencies; no dual-package hazard; tree-shaking verified for unused exports; turbo pipeline ordering (`build` before dependents' typecheck).

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `pnpm build` emits `dist` with ESM, types and maps for `@sleekstack/ui`.
- **R2:** `npm pack` tarball installed in a temp project typechecks a JSX component and runs `mount`/`renderToString`.
- **R3:** ui-demo consumes the built package via its public entry points, not source paths.
- **R4:** Effect and React are peers; the packed manifest has no workspace protocol leaking.
- **R5:** The package stays `private: true`; an ADR notes the publish gate (showcase port).

## Quick commands
<!-- scope: technical -->

`pnpm turbo run build test typecheck --filter=@sleekstack/ui...`

## Boundaries
<!-- scope: business -->

No npm publish, no changesets, no docs site change.

## Decision Context
<!-- scope: both -->

Ordered after hydration so the size budget is measured on the built output.
