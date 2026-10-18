---
satisfies: [R5, R2]
---
# fn-58-effect-native-records-layer-in.9 Showcase demo: records in the Model/Draft page

## Description
Extend the showcase Model/Draft demo with a record, a relationship and a commit against a fake adapter Layer, as the end-to-end check of the feature.

**Size:** S
**Files:** apps/showcase/src/pages/model.tsx, apps/showcase/src/pages/shell.tsx, apps/showcase/test/model.test.tsx
**Touches:** apps/showcase/src/pages/model.tsx, apps/showcase/src/pages/shell.tsx, apps/showcase/test/model.test.tsx

### Approach
- Reuse the existing demo structure in `apps/showcase/src/pages/model.tsx`; add a `Post` and `User` record with an in-memory adapter Layer, show `related`, and a form that edits through the derived Draft and `commit`.
- Keep the demo test free of build artifacts (memory: showcase tests must not read gitignored build files).

#- From task 8: the docs snippets in `apps/docs/snippets/models/` (`records.ts`, `book-page.tsx`, `book-query.tsx`) show the shipped record API in use; match that style. The showcase architecture and fixtures tests require every file under `src/` to be registered (task 7 added the `size/records` rule), so register any new showcase file the same way.

## Investigation targets
**Required**:
- `apps/showcase/src/pages/model.tsx` - current demo
- `apps/showcase/test/` - existing demo test pattern

## Acceptance
- [ ] The page shows a record, its relationship and a Draft editing it
- [ ] A save updates every view of the record
- [ ] The demo test passes with `pnpm turbo run test typecheck --filter=showcase`

## Done summary
The showcase Model and Draft page now has a Records section (apps/showcase/src/pages/model.tsx). It defines `Post` and `User` records over an in-memory adapter Layer (`FakeApiLive`, supplied by a `<Provider>`). `PostCard` loads the post with `useRecord` and shows its author through `Post.related`. `UserCard` loads the user, and `UserEditor` edits it through the derived Draft (`User.useDraft`) and saves with `User.commit`.

The new test in apps/showcase/test/model.test.ts covers these steps:
- an empty name shows the field error, and a failed commit writes nothing
- while the save is in flight, nothing changes (pessimistic)
- after the acknowledgement, both the user card and the post's byline (through `related`) show the new name
- the Draft is clean again, so its baseline moved to the saved user

Covers R2 and R5 end to end.

Notes:
- The analyzer reports `Result.match(...)` as a returned component as `Unresolved`, so the cards use `Result.isInitial` / `isFailure` branches, like size/records.tsx.
- shell.tsx is unchanged. Its page label stays "Model and Draft", because app.test.ts (outside Touches) pins that label.
- A first gate re-run at HEAD exited 127 (a quoting slip in the shell). The gate receipt was written right after that run. The correct re-run at the same HEAD was green: 19/19 turbo tasks, served from turbo's cache of the identical pre-commit run, which ran 56 showcase tests fresh.

stage: plan-sync - skipped(no drift)
Baseline: green via handoff (verified at 1ef45f6 by task 8; only .flow/ changed since).
stage: impl-review - ran (codex gpt-6.1-sol fan-out: correctness, contracts and integration all SHIP, 0 findings)
Tier: explicit routing from project CLAUDE.md (implementer: opus at medium)
## Evidence
- Commits: 04804f017fb60cc02690edc5ba11cd566d2cbfee
- Tests: pnpm turbo run test typecheck --filter=showcase --filter=@sleekstack/model... --filter=@sleekstack/analyze
- PRs: