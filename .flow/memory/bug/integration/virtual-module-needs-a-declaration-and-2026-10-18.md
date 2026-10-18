---
title: Virtual module needs a declaration and computed keys; watch routesDir
date: "2026-10-18"
track: bug
category: integration
module: packages/ui-vite/src/routes.ts
tags: [vite, virtual-module, routes, types]
problem_type: integration
symptoms: TS2307 on virtual:sleekstack/routes; __proto__ route missing; outside-root route adds ignored
root_cause: "virtual module had no types, object-literal keys, routesDir not added to watcher"
resolution_type: fix
related_to: [bug/integration/build-time-id-duplicate-check-must-use-2026-10-18, bug/integration/derived-draft-input-type-needs-the-2026-10-18, bug/integration/node-loaded-packages-vite-plugins-need-2026-10-18, bug/integration/vite-plugin-memo-must-reset-per-build-2026-10-18]
---

## Problem
The first `virtual:sleekstack/routes` emitted a plain object literal and had no types. Importing it in TS failed with TS2307, so the literal paths never reached the router's `Params`. A route file named `__proto__` vanished from the generated object literal. A `routesDir` outside the Vite root was never watched.

## Solution
`packages/ui-vite/src/routes.ts` now writes `routes.gen.d.ts` inside routesDir (an ambient `declare module` with literal paths and `typeof import('./file.ts').default` page types), uses computed keys in the generated code, and calls `server.watcher.add(dir)`.

## Prevention
For any virtual module, test a TS consumer against its declaration and not only `ssrLoadModule`. Emit generated keys as computed properties. Test watching with real fs events for a configured directory outside the root.
