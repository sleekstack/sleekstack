---
title: External app scope close must wait for providers' deferred component closes
date: "2026-09-29"
track: bug
category: runtime-errors
module: packages/react/src/managedScope.ts
tags: [react, scope, lifecycle, islands]
problem_type: runtime-error
symptoms: External app scope close must wait for providers' deferred component closes
root_cause: LayerProvider defers close to a microtask; owner closed app scope synchronously
resolution_type: fix
related_to: [bug/runtime-errors/island-async-chunk-load-must-check-an-2026-09-29]
---

## Problem
An externally owned app scope shared by several LayerProvider roots was closed by its owner right after the last unmount, but LayerProvider defers component-scope close to a microtask, so app finalizers ran before component finalizers.

## Solution
managedScope tracks committed providers per external app scope; `closeProvidersOn(appScope)` (awaits one microtask, then LIFO closes) runs before the owner closes the app scope. Kit `AppScopeHandle.close()` calls it.

## Prevention
Test "close() right after the last unmount" with no sleep; never hide ordering races behind setTimeout waits in tests.
