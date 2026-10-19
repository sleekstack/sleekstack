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
Built the article page, the markdown renderer, comments, the editor and the docs entry. All Placeholder pages are gone.

- Article page (`src/pages/article.tsx`): loaders `article` and `comments` (an unknown slug is the 404 page). The author row shows Edit and Delete to the author. Delete goes through `toHome` and lands on `/`. Anyone else sees Follow and Favorite: the profile's `FollowButton` and the preview's `FavoriteButton`, now exported as plain wrapper components so their inferred types stay nameable. Comments are listed newest first. An anonymous viewer gets a sign-in prompt instead of the form. Only the comment's author sees its delete button. Added and deleted comments are kept as local edits keyed on the loader's list, so a reload replaces them.
- Markdown (`src/modules/articles/presentation/markdown.ts`): `markdown(body)` builds ui nodes with `el`/`fragment` and handles headings, paragraphs, fenced code, flat lists, inline code, strong/emphasis (nested one level), and links. A link is allowed only if it is relative or uses `http:`, `https:` or `mailto:`. Any other scheme keeps its label as text. HTML in a body stays text because ui has no raw-HTML node.
- Editor (`src/pages/editor.tsx`): one Draft serves both create and edit. `tag` is a Draft field that is never sent. Enter adds the tag (deduped) and does not submit, and a tag pill's close icon removes it. A save lands on the saved article through the new `toPage(result, run, to)` in `form.tsx`; `toHome` is now `toPage` to `/`. The `editable` loader sends anyone but the author to the article: a 302 on the server, a navigation in the browser. The body textarea uses the settings workaround: the server renders the value as its content.
- Docs: added a Conduit section to `apps/docs/content/docs/showcases.mdx` that includes `apps/realworld/src/pages/routes.ts`, and added `apps/realworld` to the include allowlist in `apps/docs/test/guides.test.ts`. Added a Pages section to `apps/realworld/README.md`. The R2 Postman note was already there: classic collection `1fcad4a` gives 0 failed; v2 fails 7 by design.
- Review fix (NEEDS_WORK -> SHIP): a link label can no longer contain a bracket and a link target no parenthesis, so markdown parsing stays linear on malformed input (80 KB of `[` took 4 s before). The comment field is disabled while a post is pending.
- Outside the listed Touches: `src/app.tsx` (wiring), `src/pages/layout.tsx` (`Placeholder` removed), `src/pages/form.tsx` (`toPage`), `src/pages/profile.tsx` and `presentation/preview.tsx` (exports), `modules/articles/index.ts` (exports), `apps/realworld/README.md`. The editor tests are in `test/article.test.ts`; there is no `editor.test.ts`.
- Tests: `test/markdown.test.ts` (14 cases) covers HTML as text, neutralized `javascript:`/`data:`/tab-split links, safe links, nested emphasis, block types, the empty body, and long unmatched delimiters. `test/article.test.ts` (9 cases) covers anonymous SSR and hydrate with no call; another user's follow, favorite, comment post (read-only while pending) and own-comment-only delete; the blank comment error; the author's Edit and Delete-to-`/`; the 404; the editor creating with Enter tags and landing on the article; blank-field errors with edits kept; editing to a new slug; and the non-owner redirect on server and client. Mutation checks: removing the owner check, the scheme check, the comment-author check or the pending disable each turned a test red.
- Gates: `pnpm turbo run test typecheck --filter=realworld --filter=docs` green (realworld 134, docs 37); `pnpm --filter realworld check` clean. pnpm-lock.yaml unchanged.
- baseline: green via handoff (verified at 5fba98b by fn-61-realworld-app-on-sleekstack.7)
- Follow-ups: the router `Link` has no `class` prop, and an atom-bound textarea `value` is not rendered on the server (both carried from t6/t7).
- Tier: session (jev-unavailable(no_key))

stage: impl-review - ran (codex fan-out rid 42b375964bfc4fe3be0c15f2366af39e NEEDS_WORK (quadratic link scan, comment draft reset while pending) -> fix 611d09fe -> re-review SHIP)
## Evidence
- Commits: 028a6a03184874be8a511d725d595df80e4c981d, 611d09fec2775681c39365b05760b595c21cd2d9
- Tests: pnpm turbo run test typecheck --filter=realworld --filter=docs, pnpm --filter realworld check
- PRs: