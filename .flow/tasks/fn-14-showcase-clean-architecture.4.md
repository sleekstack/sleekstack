---
satisfies: [R1, R7, R8, R10]
---
# fn-14-showcase-clean-architecture.4 Move files into domain/application/infrastructure/delivery/client layout

## Description
Migration step 4. Move to the spec's src/ layout: infrastructure/{board-store.memory,runtime-infra.live,request.live,demo.live,app}.ts, delivery/{actions,runtime.server,demo-mode,report.server}.ts, client/{components,services,drafts}/, lib/contracts.ts (generic, no app imports). AppLive composed only in infrastructure/app.ts; delivery/runtime.server.ts is the one documented delivery file allowed to import it (composition boundary); application/ never imports infrastructure/. Update app/ pages to call through delivery, package.json check/report --entry paths, src/errors/graphs.ts if needed, and test import paths only. Remove models/ -> server import (and models/ dir if emptied).

## Acceptance
- [ ] Client graph imports only domain/* (bundle test unchanged) (R1)
- [ ] No models/ or client/ file imports delivery/ or infrastructure/ except Server Action refs (R7)
- [ ] sleekstack check reports app root; /graph and /errors render (R8)
- [ ] All showcase tests + Playwright smoke pass with only import-path changes (and the smoke graph assertion already moved to BoardStore in task 2) (R10)

## Done summary
Moved apps/showcase into the spec layout: AppLive composed only in infrastructure/app.ts (which also re-exports RequestLive/DemoLive), delivery/runtime.server.ts as the sole importer of app.ts, RequestContext Tag in domain/tags.ts, client/{components,services,drafts}, lib/contracts.ts, and a delivery/board.server.ts read used by app/page.tsx. check/report entries and the cli check test point at the new runtime path; the board-view test moved out of models/ so models/ imports no infrastructure.

Deviation: act() stays in delivery/act.server.ts (requests.test imports it; a 'use server' file may only export async functions). ScopeLog stays a component under client/components. README is task 5.

stage: impl-review - ran (codex: fan-out NEEDS_WORK x2, re-review SHIP)
Tier: opus at medium
## Evidence
- Commits: cc7f0f4ad92d6ee390b2ed053e8146851fcddd84, eb916aa9b950e554811ef0825b900a06edcef030, 68255899b131e8d2b7097e38fdb437cb7916020a
- Tests: pnpm -F showcase typecheck, pnpm -F showcase test (45/45), pnpm -F showcase build && pnpm -F showcase test:bundle (3/3), pnpm -F showcase test:e2e (3/3), pnpm -F showcase check (app root ok), packages/cli vitest check.test.ts (11/11)
- PRs: