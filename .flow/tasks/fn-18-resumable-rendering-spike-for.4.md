---
satisfies: [R7, R8]
---
# fn-18-resumable-rendering-spike-for.4 ui-demo: resumable counter, jsdom resume test and size measurement

Touches: [apps/ui-demo/**, pnpm-lock.yaml]

## Description
Prove the model end to end (R7) and measure the client runtime (R8's number): a counter in the demo app, server-rendered then resumed in a jsdom test, plus a gzipped size of the `resume` entry confirmed React-free.

**Size:** M
**Files:** `apps/ui-demo/src/counter.tsx` (new component, handler, atom), `apps/ui-demo/src/resume-entry.ts` (new client entry that calls `resume`), `apps/ui-demo/test/resume.test.ts` (new, jsdom), `apps/ui-demo/test/size.test.ts` (new) or a script, `apps/ui-demo/package.json` (add `@sleekstack/core`).
**Touches:** [apps/ui-demo/**, pnpm-lock.yaml]

### Approach
- Follow the existing demo test pattern: `renderToString` then DOM work in `apps/ui-demo/test/app.test.ts` (jsdom pragma at line 1); keep `apps/ui-demo/src/app.tsx` and the clean-app Analyzer test (`test/fixtures.test.ts`) working.
- The test serves the handler as a lazy loader and asserts the handler loader was not called before the first click and the component function was not called during resume.
- Size: nothing in the repo measures gzip (`apps/showcase/src/__tests__/bundle.test.ts` only scans for markers). Bundle the `resume` entry with esbuild or `vite build` (already in the workspace) and take `zlib.gzipSync` of the output; assert the bundle contains no `react`. Do not read the generated `.sleekstack` report (memory: showcase tests must not read the build output). Print the number so task 5 can record it.

### Investigation targets
**Required** (read before coding):
- `apps/ui-demo/src/app.tsx` and `apps/ui-demo/test/app.test.ts` — demo and test pattern
- `apps/ui-demo/test/fixtures.test.ts` — clean-app assertion to keep green
- `apps/ui-demo/package.json` and `apps/ui-demo/vite.config.ts` — scripts and build setup

**Optional** (reference as needed):
- `apps/showcase/src/__tests__/bundle.test.ts` — how a build is inspected in tests

### Acceptance
- [ ] jsdom test: server-rendered counter resumes, a click loads the handler lazily and the bound count updates; zero component calls during resume
- [ ] Size measurement reports the gzipped bytes of the `resume` entry and fails if the bundle contains React
- [ ] `pnpm --filter ui-demo test` and typecheck pass; the existing demo tests are unchanged

## Acceptance
- [ ] TBD

## Done summary
Resumable counter demo (apps/ui-demo/src/resume/*), a jsdom resume test, and a resume-entry size test. `"sideEffects": false` in packages/ui/package.json lets a normal Vite build (no tree-shaking override) drop the React-importing dom.ts/string.ts from the ui barrel. I checked by hand that every packages/ui/src module has only declarations at the top level, with no import-time side effects. fixtures.test.ts now expects 2 Analyzer trees because the resume entry is a second root.

Sizes (normal build, React absent): resume entry 303835 B min / 78633 B gzip; lazy handler chunk 229 B min / 183 B gzip. Cite these in ADR 0017 (task 5).

stage: impl-review - ran (codex round 1 NEEDS_WORK P1 moduleSideEffects override, round 2 SHIP)
## Evidence
- Commits: 21e1db617213423aea427759fc1c64cd80b8fdd2, b5d2b4bd995b5d6d704a6b218d78c833bfe738b7
- Tests: pnpm typecheck && pnpm test, pnpm --filter @sleekstack/ui test, pnpm --filter ./apps/ui-demo test
- PRs: