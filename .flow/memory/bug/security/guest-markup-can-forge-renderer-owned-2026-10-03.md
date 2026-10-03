---
title: Guest markup can forge renderer-owned data-sleek attributes
date: "2026-10-03"
track: bug
category: security
module: packages/ui/src/string.ts
tags: [resume, guest, ssr]
problem_type: security
symptoms: Guest markup can forge renderer-owned data-sleek attributes
root_cause: Delimiter-based regex misses HTML parser attribute forms like <b/attr>
resolution_type: fix
---

## Problem
Resumable server render trusted React guest markup; a guest could emit `data-sleek-*` attributes and forge resumable handlers/binds.

## What Didn't Work
Scanning guest HTML with `/\sdata-sleek-/` — `<b/data-sleek-on-click=x>` (via dangerouslySetInnerHTML) parses as an attribute but skips the whitespace check.

## Solution
Reject any `data-sleek-` substring in guest output (packages/ui/src/string.ts Guest case); report via onError and render nothing.

## Prevention
Never regex-validate HTML attributes by delimiter; match the reserved token anywhere, or use a renderer-owned boundary.
