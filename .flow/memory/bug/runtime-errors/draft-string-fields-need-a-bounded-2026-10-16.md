---
title: Draft string fields need a bounded check before Number() in toDto
date: "2026-10-16"
track: bug
category: runtime-errors
module: apps/showcase/src/pages/model.tsx
tags: [draft, schema, validation, todto]
problem_type: runtime-error
symptoms: a digit-only age passes validation but saves Infinity
root_cause: "pattern checked characters, not the converted number's range"
resolution_type: fix
---

## Problem
A Draft field that holds a number input's string was validated with `Schema.pattern(/^\d+$/)` and converted with `Number(d.age)` in `toDto`. A long digit string passes the pattern, but `Number()` of it is an unsafe integer or `Infinity`. The save then wrote `Infinity` (JSON `null` on a real wire), and the re-seeded Draft held `"Infinity"`, which failed its own schema.

## What Didn't Work
A digit-only pattern: it checks the characters, not that the converted value is a safe number.

## Solution
Validate the converted range as well: `isAge = (s) => /^\d{1,3}$/.test(s) && Number(s) <= 150`. Use it in the schema filter and in `toModel`'s preview (`apps/showcase/src/pages/model.tsx`). Regression: a 400-digit age shows the error in `apps/showcase/test/model.test.ts`.

## Prevention
When a schema validates a string that `toDto` converts, bound the converted value (a length cap plus a range, or `Number.isSafeInteger`). Test one overflowing input. `apps/docs/snippets/models/profile.tsx` still uses the unbounded `wholeNumber` pattern.
