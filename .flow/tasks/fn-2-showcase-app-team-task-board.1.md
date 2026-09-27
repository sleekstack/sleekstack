---
satisfies: [R1, R2, R3, R11]
---
# fn-2-showcase-app-team-task-board.1 Scaffold apps/showcase + domain modules + /graph and /errors pages

## Description
Create the Next 15 app skeleton and the whole service graph, plus the two pure-core pages (graph explorer, error gallery). This is the early proof point: it shows the workspace packages build under Next.

**Size:** M
**Files:** apps/showcase/{package.json,next.config.ts,tsconfig.json,vitest.config.ts}, app/layout.tsx, app/page.tsx (nav placeholder), app/graph/page.tsx, app/errors/page.tsx, src/domain/tags.ts, src/domain/*.server.ts (Store, repos, ActivityLog, Clock, Logger, IdGen), src/domain/modules.server.ts, src/errors/cases.server.ts, src/__tests__/graph.test.ts, src/__tests__/errors.test.ts
**Touches:** [apps/showcase/**, pnpm-lock.yaml]

### Approach
- package.json: name `showcase`, deps `next ^15.3`, react 19.2, effect ^3.21, `server-only`, `@sleekstack/{core,next,react}: workspace:*`. Scripts: dev, build, typecheck (`tsc --noEmit`), test (vitest).
- next.config: `transpilePackages` for the three workspace packages, whose `main` points at src .ts.
- Tags only in `src/domain/tags.ts` (pattern `apps/playground/src/tags.ts`). Implementations in `*.server.ts`, which start with `import 'server-only'` and export `SERVER_ONLY_MARKER` (pattern `apps/playground/src/services.server.ts`). Vitest must alias `server-only` to an empty module.
- Modules: e.g. Infra (Clock, Logger, IdGen, bare Layer), Data (Store, repos; private internal helper), Activity (ActivityLog via `declareLayer`), App (imports Data plus Activity through a thunk). Store is module-scoped with seeded fixtures.
- `/graph`: a server component that renders `snapshot(buildGraph(appEntries))` as a table. Accept a `demo` flag argument now; wiring comes in .2.
- `/errors`: each case is a function building one broken graph, run in its own try/catch at render and reporting `_tag` plus message.

### Investigation targets
**Required:**
- packages/core/src/index.ts:7-21, graph.ts:181-268, errors.ts, module.ts:39-116
- apps/playground/src/tags.ts, services.server.ts
**Optional:**
- packages/core/src/__tests__/graph.test.ts (broken-graph fixtures)

### Key context
- AmbiguousProvider needs two providers of one Tag at equal precedence; shadowing is not an error.
- The raw-Layer failure has no class of its own: it is a bare Layer that dies inside a module, with the message `Raw Layer in module "X" failed to build`.
- A bare Layer must be self-contained (requirement type `never`), and no `service()` may require it.

### Acceptance
- [ ] `pnpm --filter showcase build` succeeds; /graph and /errors render in `next dev`
- [ ] graph.test: the app graph builds, the snapshot has ≥3 modules, one thunk import, one private node, one declared and one opaque node
- [ ] errors.test: every one of the 8 cases throws its expected tag or message
- [ ] typecheck green

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
