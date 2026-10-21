---
satisfies: [R4, R5]
---
# fn-66-server-services-di-style-server.6 boundary: `*.server.ts` in the client graph fails the build and `sleekstack check`

## Description
The hard boundary that replaces import pruning as the safety net. The client build refuses to load a `*.server.ts` and names the import chain; the analyzer reports the same thing statically as `ServerFileInClientGraph`. A browser entry is any module importing `virtual:sleek/server`.

**Size:** M
**Files:** packages/ui-vite/src/server-services.ts or packages/ui-vite/src/server-boundary.ts (new), packages/analyze/src/serverServices.ts, packages/analyze/src/errorCodes.ts, packages/analyze/src/__tests__/, packages/ui-vite/src/__tests__/, apps/docs/content/docs/errors.mdx
**Touches:** [packages/ui-vite/src/**, packages/analyze/src/**, apps/docs/content/docs/errors.mdx]

### Approach
- Vite side: in the client consumer (`this.environment.config.consumer === 'client'`, as `routes.ts:266` branches), a `load` or `resolveId` hook on ids matching `*.server.<ext>` throws with the importer chain (build: module info importers; dev: the client environment module graph). Type-only imports are erased before resolution, so they never reach it; prove that in a test instead of special-casing it.
- Analyzer side: starting from every module that imports `virtual:sleek/server`, walk static and dynamic imports (not `import type`) and report the first `*.server.ts` reached, at the importing statement, with the chain in the message. New code `ServerFileInClientGraph`: table row and `errors.mdx` entry.
- Wire the new check into `sleekstackAnalyzer` (`packages/ui-vite/src/analyze.ts`) beside task 3's.

### Investigation targets
**Required** (read before coding):
- `packages/ui-vite/src/routes.ts:256-275` — environment-aware hook pattern
- `packages/ui-vite/src/__tests__/prerender.test.ts` — running a real `vite build` on a fixture in a test
- `packages/analyze/src/serverServices.ts` (tasks 3 and 4) — program and diagnostics already there
- `packages/analyze/src/components.ts` — existing import-graph walking, if any, to reuse

### Key context
Realworld and the showcase wire only parts of `sleekstack()`; the boundary hook lives in the standalone `serverServices` plugin from task 5 so they get it.

## Acceptance
- [ ] Test: `vite build` of a fixture whose client entry (transitively) imports a `*.server.ts` fails and the message lists the chain; the SSR build of the same fixture succeeds.
- [ ] Test: a type-only import of a `*.server.ts` from client code does not fail; a `*.server.ts` imported only by other server code or a test is not reported.
- [ ] Analyzer fixtures: `ServerFileInClientGraph` fires for a direct and a transitive import from a module that imports `virtual:sleek/server`, with file:line; silent for the clean fixture.
- [ ] Table row, `errors.mdx` entry and `errorCodes.test.ts` pass.
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=@sleekstack/ui-vite... --filter=sleekstack` passes.

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
