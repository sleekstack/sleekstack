---
title: Per-position regex scanners must stop at the next opening delimiter
date: "2026-10-18"
track: bug
category: performance
module: apps/realworld/src/modules/articles/presentation/markdown.ts
tags: [markdown, regex, quadratic, ssr]
problem_type: performance
symptoms: Article SSR blocks for seconds on a body of unmatched brackets
root_cause: "Link regex character classes crossed the next [ so each failed attempt rescanned the suffix"
resolution_type: fix
---

## Problem
The in-app markdown renderer tried `LINK.exec(rest)` at every `[`. With a label class `[^\]]+` and a target class `[^)\s]+`, a failed match scanned to the end of the paragraph, so a body of 80 KB of `[` took about 4 s to render, synchronously, during SSR.

## What Didn't Work
A per-position regex scanner whose character classes can cross the next opening delimiter. Each failed attempt rescans the same suffix.

## Solution
Exclude the opening delimiter from each class: label `[^[\]]+`, target `[^()\s]+` (apps/realworld/src/modules/articles/presentation/markdown.ts). A failed match then stops at the next bracket or parenthesis, so the attempts cover disjoint spans and the parse is linear.

## Prevention
For every delimiter regex tried at each position, check that a failed match stops at the next opening delimiter. Keep a test that renders about 100 KB of each unmatched delimiter (`[`, `[a](`, `**a *`, a backtick, `_a `) under a time bound.
