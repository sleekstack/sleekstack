---
satisfies: [R8, R10, R12]
---
# fn-68-file-routed-controllers.8 ui-vite: server-app codegen for Controllers and dev forwarding

Touches: [packages/ui-vite/src/server-services.ts, packages/ui-vite/src/dev.ts, packages/ui-vite/src/index.ts, packages/ui-vite/src/__tests__/**, packages/ui-vite/README.md]

## Description
Emit the discovered-app module that `start()` reads, from the discovery of task 7 and the reader of tasks 3 and 4, and give dev servers what they need to forward Controller paths (R8, R10, R12).

**Size:** M
**Files:** `packages/ui-vite/src/server-services.ts`, `packages/ui-vite/src/dev.ts`, `packages/ui-vite/src/index.ts`, `packages/ui-vite/src/__tests__/server-services.test.ts`, `packages/ui-vite/README.md`

### Approach
- Emit one entry per Controller in the contract of task 1: route name and pattern, per-method input Schemas (params, query, body; string codecs on the HTTP face) and success Schema printed through the extended `printSchema`/`entriesCode` (`server-services.ts:63-115`), and the option chain as lazy imports of the Controller and `_defaults.ts` modules. Generated keys are computed properties; read nothing from a virtual module at top level.
- When file routes exist (`virtual:sleekstack/routes`) and the app gives no `router`, the module also exports the page router built from them (`router({ table, pages, notFound })`, as realworld's `src/app.tsx:8` does by hand).
- Declaration: name each Controller module by import type so the analyzer reads it through the declaration (memory `analyzer-reads-every-file-route-through`).
- Dev forwarding: export `devMiddleware` (`dev.ts:11-29`) and a predicate the discovered app provides, so an app's dev server no longer hard-codes `/api/`.
- The client environment never loads a Controller: the load guard from task 2 fails the build with the chain (R12).

### Investigation targets
**Required** (read before coding):
- `packages/ui-vite/src/server-services.ts:63-135,245-282`
- `packages/ui-vite/src/dev.ts:11-29`
- `apps/realworld/src/app.tsx:8` and `apps/realworld/server/dev.ts:13-16`
- `.flow/memory/bug/integration/analyzer-reads-every-file-route-through-2026-10-20.md`

**Optional**:
- `packages/ui-vite/src/__tests__/plugin.test.ts` - an http dev entry

## Acceptance
- [ ] a generated entry round-trips through `start` in a test: a Controller with a referenced Schema, a printed type with string codecs, and an option chain
- [ ] the module exports the page router only when file routes exist and `router` is not given
- [ ] the dev forwarding predicate matches Controller paths and not asset or module requests
- [ ] `vite build --ssr` resolves the module and the client build excludes every Controller
- [ ] the generated declaration is committed in the fixtures and typechecks
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui-vite...` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
