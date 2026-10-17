---
title: "Resume client entry must not import a handler's module, even for its atom"
date: "2026-10-17"
track: bug
category: integration
module: apps/docs/snippets/ui/resume.client.ts
tags: [ui, resume, docs, code-splitting]
problem_type: integration
symptoms: resume example loaded handler code eagerly
root_cause: client entry imported the atom from the handler module and shared a module with the server component
resolution_type: fix
related_to: [bug/integration/analyzer-component-pass-skipped-2026-10-03, bug/integration/docs-next-snippets-need-use-server-2026-09-28, bug/integration/new-ui-component-factory-needs-analyzer-2026-10-09, bug/integration/typedoc-markdown-anchors-differ-from-2026-09-28]
---

## Problem
A docs snippet showing `resume` put the server component, the serializable atom and the client entry in one module, and the client entry imported the atom from the handler's module. Both made the handler code load eagerly, contradicting the guide's claim that `resume` loads each handler on its first event.

## Solution
Split into four modules: `count.ts` (the atom), `increment.ts` (the `defineHandler`), `resume.tsx` (server render, imports the handler statically) and `resume.client.ts` (imports only the atom and `() => import('./increment')`). See apps/docs/snippets/ui/.

## Prevention
A resume client entry must import no component and no handler module, directly or through a shared module; keep serializable atoms in their own module.
