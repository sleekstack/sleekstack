---
title: Syntactic default-export check must ignore type-only (erased) exports
date: "2026-10-20"
track: bug
category: build-errors
module: packages/ui-vite/src/routes.ts
tags: [typescript, vite, routes, exports]
problem_type: build-error
symptoms: export default interface passed the route default check
root_cause: TS AST check counted erased type-only default exports
resolution_type: fix
---

## Problem
The route-file default-export check parsed the file and counted any `default` export, so `export default interface X {}` and `export type { X as default }` / `export { type X as default }` passed. Those are erased at transpile, so the generated module imported a namespace with `m.default === undefined` instead of failing naming the file.

## Solution
`hasDefault` in `packages/ui-vite/src/routes.ts` skips interface declarations, type-only export declarations and type-only specifiers.

## Prevention
A syntactic export check must ask "does this survive transpilation?": test type-only forms (default interface, `export type {}`, inline `type` specifiers) alongside the runtime forms.
