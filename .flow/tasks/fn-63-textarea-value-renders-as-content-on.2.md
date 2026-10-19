---
satisfies: [R4]
---
# fn-63-textarea-value-renders-as-content-on.2 realworld drops the textarea workaround; docs note

Touches: apps/realworld/src/pages/settings.tsx, apps/realworld/src/pages/editor.tsx, apps/realworld/test/auth.test.ts, apps/realworld/test/article.test.ts, apps/docs/content/docs/ui.mdx

## Description
Remove the duplicate textarea children and their comments in the settings bio and the editor body so they pass `value` only, check the tests, and add the docs note.

**Size:** S
**Files:** `apps/realworld/src/pages/settings.tsx` (55-64), `apps/realworld/src/pages/editor.tsx` (72-81), `apps/realworld/test/auth.test.ts` (~124), `apps/realworld/test/article.test.ts` (~207-246), `apps/docs/content/docs/ui.mdx` (near line 31)

### Approach
- Keep `value={draft.field(...)}`; delete the `{user.bio ?? ''}` / `{article?.body ?? ''}` children and the workaround comments.
- Tests that look at the server HTML should assert the text is the textarea content; the hydrated and navigated-back cases keep passing.
- `ui.mdx`: one short note beside the atom-binds-an-attribute sentence: a textarea's `value` renders as its content on the server, and `value` with children is an error.
- The article page's comment textarea (`article.tsx` 139-145) has no value: no change.

### Investigation targets
**Required**:
- `apps/realworld/src/pages/settings.tsx`, `apps/realworld/src/pages/editor.tsx`
- `apps/realworld/test/auth.test.ts`, `apps/realworld/test/article.test.ts`
- `apps/docs/content/docs/ui.mdx`

### Acceptance
- [ ] No textarea in `apps/realworld` has both `value` and children
- [ ] Settings and editor tests pass, including the server-rendered text and the hydrated state
- [ ] `pnpm turbo run test typecheck --filter=realworld --filter=docs` and `pnpm --filter realworld check` green

## Acceptance
- [ ] TBD

## Done summary
The RealWorld settings bio and editor body textareas now pass `value` only; their duplicate children and workaround comments are gone. The settings (auth.test.ts) and author-edit (article.test.ts) tests now also assert that the server HTML carries the text as textarea content with no `value` attribute. ui.mdx has a note that a textarea's `value` renders as its content on the server and that `value` plus children throws a `TypeError`. The ADR 0021 amendment already landed in task .1.

baseline: red (realworld#test, 3 editor tests hit the value+children TypeError; inherited from task .1, recorded in its done summary). Post-change: `pnpm turbo run test typecheck --filter=realworld --filter=docs` green (realworld 152/152, docs 52/52), `pnpm --filter realworld check` green, spec Quick command `pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=showcase --filter=realworld` green (15/15, turbo cache hits on the committed tree).

stage: impl-review - ran (codex fan-out, 3 draws SHIP, rid 1fe90608d8354976b41fbfd68e316e43)
Tier: session (jev-unavailable(no_key)); actual model: claude-opus-5-5
## Evidence
- Commits: 9669c43631535a41a922193c71daf9824344bc14
- Tests: pnpm turbo run test typecheck --filter=realworld --filter=docs, pnpm --filter realworld check, pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=showcase --filter=realworld
- PRs: