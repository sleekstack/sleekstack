---
title: "Analyzer reads every file route through the declaration, notFound included"
date: "2026-10-20"
track: bug
category: integration
module: packages/analyze/src/components.ts
tags: [analyzer, file-routes, ui-vite, declaration]
problem_type: integration
symptoms: _notFound unanalyzable under a tsconfig files list; fromReact/lazy route defaults Unresolved
root_cause: "notFound declared as bare Render (no module); route defaults read as functions only, bypassing element dispatch"
resolution_type: fix
---

## Problem
The analyzer read file-route pages through `routes.gen.d.ts` (`Page<typeof import('./x')>`), but `notFound` was declared as a bare `Render`. To find `_notFound`, the analyzer fell back to searching the program by file name. Under a tsconfig `files` list, `_notFound` never entered the program, so it could not be analyzed. Separately, the first version read a route file's default export as a function only, so `fromReact` and `lazy` defaults were reported Unresolved while the same component passed in a literal router.

## What Didn't Work
Searching the program by file name for `_notFound`, and then giving a better message when the file was on disk but outside the program. The case still could not be analyzed.

## Solution
The declaration names `_notFound`'s module the same way it names pages: `export const notFound: Page<typeof import("./_notFound.tsx")>["render"]`, which stays types-only. The import type pulls the module into the program under any tsconfig. The analyzer reads it with the same `pageImport` / `routeModule` helpers it uses for pages. A route file's default export goes through the shared `element()` path, the same one as `<Default />` (packages/analyze/src/components.ts).

## Prevention
Anything the analyzer reads from generated code must be named in the declaration as an import type. Never find it by file name next to the declaration. For a new way into a component, reuse the existing element dispatch so it keeps parity with the literal form, and test a `fromReact` / `lazy` case against it.
