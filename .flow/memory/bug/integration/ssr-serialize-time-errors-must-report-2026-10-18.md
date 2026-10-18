---
title: SSR serialize-time errors must report to onError explicitly
date: "2026-10-18"
track: bug
category: integration
module: packages/ui/src/string.ts
tags: [ssr, head, onError]
problem_type: integration
symptoms: invalid Head tag rejected renderToString but onError got no call
root_cause: "serialize runs after runToNode, whose exit handling is what reports to onError"
resolution_type: fix
related_to: [bug/integration/kit-server-facades-must-rethrow-next-2026-10-03]
---

## Problem
`Head` tags in `renderToString` are validated where `serialize` collects them. Serialize runs after `runToNode`, so a throw there rejected the render but never reached `onError`, which the spec requires for an invalid head tag.

## Solution
`collectHead` in `packages/ui/src/string.ts` reports the error through `reportRenderError(err, c.onError)` (only when `onError` is set) and then rethrows the original error.

## Prevention
Any error raised during serialization (after `runToNode`) has to be reported to `onError` explicitly. A rejection test should also assert that `onError` was called once with the same error.
