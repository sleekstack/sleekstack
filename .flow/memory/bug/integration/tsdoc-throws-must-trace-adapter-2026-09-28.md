---
title: "TSDoc @throws must trace adapter normalization, not core error names"
date: "2026-09-28"
track: bug
category: integration
module: packages/kit/src/react/hooks.ts
tags: [tsdoc, errors]
problem_type: integration
symptoms: "TSDoc @throws must trace adapter normalization, not core error names"
root_cause: error codes documented from core names without tracing kit/next wrapping
resolution_type: fix
---

## Problem
New @throws TSDoc claimed error codes the adapters never produce: kit useService "MissingDependency" (actually `Unknown` from normalize of a plain Error), cleanup "CleanupFailed" SleekStackError (onFinalizerError gets a plain FinalizerError), next StreamingResultNotSupported rejection (wrapped in Error.cause), react LayerProvider render-time graph errors (surface via useService).

## Solution
Trace each throw through normalize()/toFinalizerError()/toRejection before writing @throws.

## Prevention
For every @throws, grep the throw site and the wrapping boundary it passes through.
