---
title: Docs Next snippets need 'use server' wrappers around kit action()
date: "2026-09-28"
track: bug
category: integration
module: apps/docs/snippets/kit/next.ts
tags: [docs, nextjs, server-actions]
problem_type: integration
symptoms: Docs Next snippets need 'use server' wrappers around kit action()
root_cause: "action() returns a plain function, not a registered Server Action"
resolution_type: fix
---

## Problem
Docs snippets exported kit/next action() results directly and called them Server Actions; they are plain async functions with no server-reference boundary. The errors guide also claimed an imports thunk fixes ModuleCycle; the walker follows thunks.

## Solution
Snippets start with 'use server' and export async wrappers (apps/docs/snippets/kit/next.ts), as in apps/showcase-kit/src/server/board.actions.ts.

## Prevention
Typecheck cannot catch Next boundary rules; mirror the showcase pattern for any Next sample.
