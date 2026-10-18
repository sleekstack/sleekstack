---
title: SQL tag aggregation must be lossless; clamp binds to SQLite integers
date: "2026-10-18"
track: bug
category: data
module: apps/realworld/server/articles.ts
tags: [sqlite, serialization, pagination]
problem_type: data
symptoms: Tag with U+001F split in two; offset 1e20 threw datatype mismatch
root_cause: Delimiter-joined group_concat and unbounded finite offset bind
resolution_type: fix
related_to: [bug/data/partial-updates-must-write-only-given-2026-10-18]
---

## Problem
Article reads aggregated tags with `group_concat(t.name, char(31))` and split on U+001F, so a tag containing that character came back as two tags. Separately, a finite but huge `offset` (`'1e20'`) passed validation and made node:sqlite throw `datatype mismatch` as a defect.

## Solution
`json_group_array(t.name)` + `JSON.parse` in apps/realworld/server/articles.ts (lossless for any text), and clamp offset to `Number.MAX_SAFE_INTEGER` before binding.

## Prevention
Never serialize user text with a delimiter in SQL aggregation; use JSON aggregation. Clamp every numeric bind parameter to a range SQLite's int64 can hold, and test `1e20`-style inputs.
