---
satisfies: [R11]
---
# fn-23-reconciling-dom-renderer-keys-host.12 docs: ADR 0015 amendment, README, CONTEXT, errors page and Analyzer docs

Touches: docs/adr/0015-host-first-component-framework.md, packages/ui/README.md, CONTEXT.md, apps/docs/content/docs/errors.mdx, apps/docs/content/docs/testing.mdx, packages/analyze/README.md

## Description
Finalization in one task (spec R11): amend, don't create a new ADR.

**Size:** M
**Files:** `docs/adr/0015-host-first-component-framework.md`, `packages/ui/README.md`, `CONTEXT.md`, `apps/docs/content/docs/errors.mdx`, `apps/docs/content/docs/testing.mdx`, `packages/analyze/README.md`
**Touches:** [docs/adr/0015-host-first-component-framework.md, packages/ui/README.md, CONTEXT.md, apps/docs/content/docs/**, packages/analyze/README.md]

### Approach
- ADR 0015: new `## Amendment: reconciling renderer` after 'reactive host subtrees' and before 'Open decisions'. Explicitly supersede the lines it contradicts: 'minimal DOM renderer that re-mounts the whole tree', 'event handlers stay in guests', 'Re-render the component, not diff', 'Lost guest state', and the rejection of ordered hook slots. Record the decisions from the spec's Decision Context (identity at run time, keyed components as instances, no lazy identity, event context at the element, closure `E` is `never`).
- `packages/ui/README.md`: State paragraph (reconciled, guests keep state), the JSX paragraph ('event handlers belong in guests'), the table rows (`useLocal`, `key`, events), the `on*` sentence, the errors list.
- `CONTEXT.md` (UI section): add **Reconciler**, **Live tree**, **Key** (with an `_Avoid_` line: the word already means Tag key and bind key), **Local state**; update **Store**, **Component**, **Handler** (resume-only; closures are the new form) and the Analyzer code list.
- `errors.mdx`: `ConditionalSlot`, `MissingKey` in 'Component errors' (and the `UnhandledError` row mentions event closures); `DuplicateKey`, `SlotMismatch` in the runtime-errors table. Check the anchors resolve (`apps/docs` link tests). `testing.mdx` code list, `packages/analyze/README.md` Component pass bullets and the fixtures sentence.

### Investigation targets
**Required**:
- `docs/adr/0015-host-first-component-framework.md`, `packages/ui/README.md:14-28`, `CONTEXT.md:63-67,122-162`
- `apps/docs/content/docs/errors.mdx:38-58`, `apps/docs/test/links.test.ts`

### Acceptance
- [ ] Every doc change in the Approach is made and no remaining sentence in the touched files says guests are remounted, handlers must live in guests, or hook slots were rejected.
- [ ] `pnpm --filter docs test` (links, coverage) and the analyze `errorCodes` / `llms` tests pass.

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
