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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
