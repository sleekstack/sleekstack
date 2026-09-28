---
title: TypeDoc markdown anchors differ from Fumadocs heading ids
date: "2026-09-28"
track: bug
category: integration
module: apps/docs/scripts/generate-api.mjs
tags: [typedoc, fumadocs, links, docs, anchors]
problem_type: integration
symptoms: TypeDoc markdown anchors differ from Fumadocs heading ids
root_cause: TypeDoc and github-slugger dedupe heading slugs differently
resolution_type: fix
last_updated: "2026-09-28"
---

## Problem
typedoc-plugin-markdown numbers duplicate anchors (`#lifetime-6`) differently from Fumadocs' github-slugger heading ids, so in-page symbol links in the generated API reference went nowhere; the link check ignored fragments so it passed.

## Solution
apps/docs/scripts/generate-api.mjs rewrites each fragment to the rendered id of its `### Symbol` heading (headings() in scripts/check-links.mjs, github-slugger in page order). check-links validates fragments and reference-style links.

## Prevention
Validate fragments against rendered ids, not generator anchors.

## Update 2026-09-28

## Problem
generate-api kept any TypeDoc anchor that existed on the page, but TypeDoc numbers duplicate slugs differently from Fumadocs, so `#module-3` existed yet named a property, not the `Module` type. The link check only tests existence, so it passed.

## Solution
rewriteAnchors (apps/docs/scripts/generate-api.mjs) resolves each link by its text to the `### <symbol>` heading first, then falls back to fragment/slug.

## Prevention
Test link identity (the target heading), not just existence.
