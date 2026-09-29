---
title: Static list evaluation must key object identity by enclosing evaluation instance
date: "2026-09-29"
track: bug
category: integration
module: packages/analyze/src/extract.ts
tags: [analyze, identity, static-evaluation]
problem_type: integration
symptoms: Static list evaluation must key object identity by enclosing evaluation instance
root_cause: provider/module cache keyed by AST node only
resolution_type: fix
---

## Problem
Static evaluation of .map/loop-built lists cached ProviderDecl/ModuleDecl by AST node, so allocations per iteration or per helper call collapsed (hiding AmbiguousProvider/DuplicateModule) or, keyed by all bindings, split shared objects.

## Solution
Key identity by node + bindings the node reads + the instance of every enclosing scope (helper invocation, mapper iteration, for-of iteration) — packages/analyze/src/extract.ts cacheKey/scopes/within.

## Prevention
For every static evaluator of runtime allocations, add fixtures for: shared object reused across iterations, fresh object per iteration ignoring the item, same helper called twice.
