---
title: TypeDoc markdown anchors differ from Fumadocs heading ids
date: "2026-09-28"
track: bug
category: integration
module: apps/docs/scripts/generate-api.mjs
tags: [typedoc, fumadocs, links]
problem_type: integration
symptoms: TypeDoc markdown anchors differ from Fumadocs heading ids
root_cause: TypeDoc and github-slugger dedupe heading slugs differently
resolution_type: fix
---

## Problem
typedoc-plugin-markdown numbers duplicate anchors (`#lifetime-6`) differently from Fumadocs' github-slugger heading ids, so in-page symbol links in the generated API reference went nowhere; the link check ignored fragments so it passed.

## Solution
apps/docs/scripts/generate-api.mjs rewrites each fragment to the rendered id of its `### Symbol` heading (headings() in scripts/check-links.mjs, github-slugger in page order). check-links validates fragments and reference-style links.

## Prevention
Validate fragments against rendered ids, not generator anchors.
