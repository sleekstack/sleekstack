---
title: Kit server facades must rethrow Next control flow before normalize
date: "2026-10-03"
track: bug
category: integration
module: packages/kit/src/next/prefetch.ts
tags: [kit, next, ssr]
problem_type: integration
symptoms: Kit server facades must rethrow Next control flow before normalize
root_cause: blanket normalize in catch
resolution_type: fix
related_to: [bug/integration/do-not-flatten-modules-for-next-per-2026-09-28]
---

## Problem
Kit prefetch normalized every rejection, swallowing Next redirect/notFound; NoServerRunner was matched by message prefix in global normalize.

## Solution
Rethrow isNextControlFlow before normalize (packages/kit/src/next/prefetch.ts); match the core message exactly and only in useQuery.

## Prevention
Every kit server entry that wraps runEffect copies action.ts control-flow check; never classify by message in shared normalize.
