---
satisfies: [R1, R3, R4]
---
# fn-61-realworld-app-on-sleekstack.8 Article page, markdown renderer, comments, editor and docs entry

Touches: apps/realworld/src/pages/{article,editor}.tsx, apps/realworld/src/modules/articles/presentation/markdown.ts, apps/realworld/test/article*.test.ts, apps/docs/content/docs/showcases.mdx, apps/docs/test/guides.test.ts

## Description
Article page (author row, owner Edit/Delete vs Follow/Favorite, comments newest first, comment form hidden for anonymous with sign-in prompt, delete only for the comment author). A small in-app markdown parser to ui nodes (headings, paragraphs, emphasis, code, links with safe schemes, lists); no raw HTML. Editor create/edit (tag chips added with Enter, required fields, non-owner redirected, save lands on the article, delete redirects to `/`). Add a Conduit section to the docs showcases page and extend the docs include allowlist.

**Size:** M
**Files:** `src/pages/{article,editor}.tsx`, `src/modules/articles/presentation/markdown.ts`, `test/article.test.ts`, `test/editor.test.ts`, `test/markdown.test.ts`, `apps/docs/content/docs/showcases.mdx`, `apps/docs/test/guides.test.ts`

### Approach
- No `innerHTML`/raw node exists in ui: emit element nodes; unsafe link schemes (`javascript:`) rendered as text.
- Draft for the editor; Form Actions for comment add/delete.
- Docs allowlist at `apps/docs/test/guides.test.ts:46-47`.
- Avoid asserting exact head/void-element HTML (fn-33/fn-59 will change it).

### Investigation targets
**Required**:
- `packages/ui/src/jsx-types.ts`, `apps/showcase/src/pages/model.tsx`, `apps/docs/content/docs/showcases.mdx:6-24`

### Acceptance
- [ ] Markdown tests: HTML in body shown as text, `javascript:` link neutralized, nested emphasis, empty body
- [ ] Article/editor/comment flows with owner, other-user and anonymous viewers; delete redirect; non-owner editor redirect
- [ ] `pnpm turbo run test typecheck --filter=realworld --filter=docs` and `pnpm --filter realworld check` pass

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
