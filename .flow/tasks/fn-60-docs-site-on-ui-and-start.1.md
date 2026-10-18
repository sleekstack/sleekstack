---
satisfies: [R5, R1]
---
# fn-60-docs-site-on-ui-and-start.1 docs content: delete the pages and snippets of the removed packages

## Description
Remove the pages and snippet folders that exist only for kit, the React adapter, the Next adapter and islands, and fix the order file and links so nothing points at them.

**Size:** S
**Files:** apps/docs/content/docs/getting-started-kit.mdx, kit-vs-effect.mdx, nextjs.mdx, react.mdx, islands.mdx (deleted); apps/docs/snippets/kit/, snippets/islands/ and any snippet only those pages include (deleted); apps/docs/content/docs/meta.json; links in the remaining pages
**Touches:** [apps/docs/content/docs/**, apps/docs/snippets/**]

### Approach
- Before deleting a snippet, search for every `<include>` of it; keep a snippet that a surviving page still uses.
- Update `meta.json` and every link into a deleted page (the link checker, `apps/docs/scripts/check-links.mjs`, finds them); point readers at the ui and start pages instead, or remove the sentence.
- Do not rewrite pages that merely mention the removed packages: that is the next task.
- Equivalence pin: the content-level docs tests (`links`, `stale`) pass.

### Investigation targets
**Required**:
- `apps/docs/content/docs/meta.json` and the five pages above
- `apps/docs/snippets/` (kit, islands, atoms-next-prefetch.tsx and who includes what)
- `apps/docs/scripts/check-links.mjs`, `apps/docs/test/links.test.ts`, `apps/docs/test/guides.test.ts`
**Optional**:
- `.flow/specs/fn-55-remove-kit-react-next-and-islands.md` (the removal spec this unblocks)

## Acceptance
- [ ] The five pages and their exclusive snippets are gone; `meta.json` lists no deleted page
- [ ] No remaining page links to a deleted page (link checker passes)
- [ ] `pnpm turbo run test --filter=docs` passes for the content-level tests that run today

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
