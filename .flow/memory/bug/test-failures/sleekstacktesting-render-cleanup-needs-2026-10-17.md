---
title: "@sleekstack/testing render cleanup needs vitest globals; dispose renders otherwi"
date: "2026-10-17"
track: bug
category: test-failures
module: packages/testing/src/render.ts
tags: [testing, vitest, cleanup]
problem_type: test-failure
symptoms: rendered ui components (timers) leak across tests
root_cause: testing registers cleanup only on a global afterEach
resolution_type: fix
---

## Problem
`@sleekstack/testing` registers its render cleanup on the runner's global `afterEach`, which exists only when vitest runs with `globals: true`. In a package without globals (packages/devtools), panels rendered with `render()` were never disposed, so a polling component's interval kept running across tests.

## Solution
Keep every `Rendered` handle and dispose it in the test file's own `afterEach` (packages/devtools/src/__tests__/uiPanel.test.tsx).

## Prevention
When adopting `@sleekstack/testing` in a package, check its vitest config for `globals: true`; without it, dispose renders explicitly.
