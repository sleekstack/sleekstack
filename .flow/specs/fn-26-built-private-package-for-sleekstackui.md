## Goal & Context
<!-- scope: business -->

`@sleekstack/ui` is consumed as TypeScript source inside the monorepo. Verified: no package in the repo is built; every package's `main`/`types` points at `src/`, and kit has only `build:types` to `dist-types`. This spec makes the first real build, private until `apps/showcase` is ported, and sets the size budget (measured here, on built output, after hydration landed).

## Architecture & Data Models
<!-- scope: technical -->

- **Tooling (decided): plain `tsc` emit** to `dist/` (ESM, `.d.ts`, source maps); no new bundler. A bundler is introduced only if the tarball test shows tsc output can't be consumed.
- **core and query (decided): built and packed alongside ui**, each with the same tsc build and `exports`, with `workspace:*` rewritten on pack. Not bundled into ui, to avoid a duplicate-package hazard for consumers who also use core.
- `exports` for `.`, `./jsx-runtime`, `./jsx-dev-runtime`, `./query` (already listed in `package.json`; point to `dist`). The `@sleekstack/analyze` dependency is not part of ui and is out of scope.
- **Peers:** `effect` moves from `dependencies` to `peerDependencies` (it is a regular dependency today), `react` stays a peer.
- **Size budget:** measure a consumer bundle (`mount` hello-world and a hydrating app) with `sideEffects: false`, the way ADR 0017 measured; record limits in a new ADR.
- Stray `.js`/`.d.ts`/`.map` under `apps/playground/src` are a `tsc` run without `noEmit`; fix the playground tsconfig or add a gitignore entry.

## API Contracts
<!-- scope: technical -->

No new public API; `package.json` fields only.

## Edge Cases & Constraints
<!-- scope: technical -->

No dual-package hazard for `effect`; tree-shaking verified for unused exports; turbo orders `build` before dependents' typecheck; source maps resolve.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `pnpm build` emits `dist` with ESM, types and maps for ui, core and query. Errors: a build with a type error fails the task.
- **R2:** Packing all three and installing the tarballs in a temp project typechecks a JSX component and runs `mount` and `renderToString` in jsdom. Errors: a leaked `workspace:*` in a packed manifest fails the test.
- **R3:** ui-demo consumes the built package through public entry points. Errors: none.
- **R4:** `effect` is a peer in the packed manifest and a consumer with one `effect` copy works. Errors: two `effect` copies are called out in the README as unsupported.
- **R5:** The package stays `private: true`; an ADR records the publish gate and the measured size budget with the method. Errors: none.
- **R6:** The playground no longer emits build residue.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run build test typecheck --filter=@sleekstack/ui...`

## Boundaries
<!-- scope: business -->

No npm publish, no changesets, no docs site change.

## Decision Context
<!-- scope: both -->

After fn-25 so the budget covers hydration. The size-budget ADR moved here from the hydration spec.


## Planning decisions
<!-- scope: technical -->

- Plain `tsc` with bundler module resolution; consumers are bundler users (Vite, esbuild). Node-native ESM import of the output is out of scope and documented. If the spike shows a bundler consumer cannot resolve the output, the spec is replanned around a bundler.
- `typecheck` and `test` gain `^build` ordering in turbo; core's dependents are re-verified.
- The tarball test wires core and query with overrides, since packing rewrites `workspace:*` to a version.
- `effect` and `@tanstack/query-core` are peers across ui, core and query.
- The size budget is asserted in a test and recorded in an ADR; the playground stray emit is fixed at the root tsconfig.


## Early proof point

Task fn-26-built-private-package-for-sleekstackui.1 validates the core approach (tsc output packs and bundles in a consumer). If it fails, re-evaluate the tooling (a bundler) before fn-26.2+

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | `pnpm build` emits `dist` with ESM, types and maps for ui, core and query. Errors: a build with a type error fails the task. | fn-26-built-private-package-for-sleekstackui.1, fn-26-built-private-package-for-sleekstackui.2, fn-26-built-private-package-for-sleekstackui.3 | — |
| R2 | Packing all three and installing the tarballs in a temp project typechecks a JSX component and runs `mount` and `renderToString` in jsdom. Errors: a leaked `workspace:*` in a packed manifest fails the test. | fn-26-built-private-package-for-sleekstackui.1, fn-26-built-private-package-for-sleekstackui.4 | — |
| R3 | ui-demo consumes the built package through public entry points. Errors: none. | fn-26-built-private-package-for-sleekstackui.5 | — |
| R4 | `effect` is a peer in the packed manifest and a consumer with one `effect` copy works. Errors: two `effect` copies are called out in the README as unsupported. | fn-26-built-private-package-for-sleekstackui.2, fn-26-built-private-package-for-sleekstackui.3, fn-26-built-private-package-for-sleekstackui.4 | — |
| R5 | The package stays `private: true`; an ADR records the publish gate and the measured size budget with the method. Errors: none. | fn-26-built-private-package-for-sleekstackui.6 | — |
| R6 | The playground no longer emits build residue. | fn-26-built-private-package-for-sleekstackui.5 | — |

