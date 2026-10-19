---
title: Build-time id duplicate check must use the same predicate as the runtime tag
date: "2026-10-18"
track: bug
category: integration
module: packages/ui-vite/src/ids.ts
tags: [vite, ids, transform]
problem_type: integration
symptoms: Duplicate component id error for non-function exports; anonymous default components lost stable ids
root_cause: Duplicate check ran on all value exports while runtime tagged only functions
resolution_type: fix
related_to: [bug/integration/node-loaded-packages-vite-plugins-need-2026-10-18, bug/integration/vite-plugin-memo-must-reset-per-build-2026-10-18]
---

## Problem
The ui-vite stable-id transform registered every exported value for the duplicate-id check but tagged only functions at runtime, so two files sharing a non-component export (`label`) failed the build. Anonymous default exports (`export default () => ...`) got no id and fell back to the load-order counter.

## What Didn't Work
Deciding "is this a component" at runtime (`typeof f === 'function'`) while the duplicate check ran at transform time on every value export: the two sets disagreed.

## Solution
`packages/ui-vite/src/ids.ts`: only bindings whose value is a function written in place (declaration, arrow, function expression, unwrapping `as`/`satisfies`) get an id, so the tagged set equals the checked set. An anonymous default function declaration gets a name inserted (stays hoisted); a default function expression becomes `const __sleekstack_default = ...; export default __sleekstack_default`.

## Prevention
When a build-time check guards a runtime action, derive both from the same static predicate. Test fixtures for each export form: named, renamed, re-export, alias, anonymous default arrow and declaration, and non-function exports.
