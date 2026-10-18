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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
