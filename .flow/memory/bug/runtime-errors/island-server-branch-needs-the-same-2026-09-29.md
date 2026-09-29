---
title: Island server branch needs the same provider nesting as the client root
date: "2026-09-29"
track: bug
category: runtime-errors
module: packages/islands/src/Island.tsx
tags: [islands, ssr, layerprovider]
problem_type: runtime-error
symptoms: Island server branch needs the same provider nesting as the client root
root_cause: providers added only to the client hydrateRoot tree
resolution_type: fix
---

## Problem
Island SSR rendered the component with no LayerProvider, so any service-backed Island threw on the server; only client roots got providers.

## Solution
Server branch nests `LayerProvider provide={app}` > `LayerProvider provide={component}` (packages/islands/src/Island.tsx). SSR test lives in its own file: a server render parks provider scopes that a same-process client provider with the same `provide` reference adopts (managedScope adoption ignores appScope).

## Prevention
Every wrapper that renders on both sides needs a server-branch test calling useService.
