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
The `*.server.ts` boundary now holds in two places. In a client environment, the standalone `serverServices()` plugin fails the load of any `*.server.ts` with the import chain (`index.html -> src/main.ts -> src/page.ts -> src/profiles.server.ts`). In build it tracks each module's first importer through `moduleParsed`, because Rolldown fills `importers` only at the end. In dev it reads the client module graph. SSR loads it normally. `analyzeServerServices` also reports `ServerFileInClientGraph` for every `*.server.ts` reachable through value imports (static, dynamic, re-export) from a module importing `virtual:sleek/server`. It reports at the importing statement with the shortest chain and does not walk into server files. `import type` and all-type named imports are skipped, and test files are never entries.

- `sleekstack check` (packages/cli/src/check.ts, a scope widening) always runs the Server Service pass, so every ServerService* code and `ServerFileInClientGraph` fail it. Text mode prints them as error lines; `--json` gets `serverServiceErrors` only when there are any. The fixture graph check output (effect-app, showcase, realworld) is byte-identical before and after.
- The generator in `serverServices()` filters `ServerFileInClientGraph` out of the errors that fail its virtual-module loads, so the SSR build of a violating app still succeeds and the client build fails through the hook.
- Table row, errors.mdx row and llms.md (regenerated with UPDATE_LLMS=1, now 7337 bytes) are in.
- Tests: the ui-vite server-services.test.ts "server boundary" block covers a client build failing with the chain while SSR succeeds, a type-only import passing, and a dev client load failing while the ssr load passes. analyze serverServices.test.ts covers the server-boundary fixture (direct, transitive and dynamic with file:line, plus the chain messages) and the server-boundary-clean fixture (silent). cli check.test.ts covers text and --json. Both new behaviors were confirmed red with the hook or walk disabled.
- The `sleekstackAnalyzer` in ui-vite analyze.ts already calls `analyzeServerServices`, so it reports the new code with no change.
- The commit trailer is Claude Opus 5.5 per the session attribution rule, not the Sonnet line in the conductor note.

baseline: green (turbo cache)
Tier: session (jev-unavailable(no_key)); project routing block pins implementer opus at medium (actual_model: claude-opus-5-5)

stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: fb78967c0f9926dd4f55b2667a9bfc8dc0f08763
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=@sleekstack/ui-vite... --filter=sleekstack, pnpm turbo run test typecheck --filter=showcase, fixture graph check (effect-app, showcase, realworld): identical
- PRs: