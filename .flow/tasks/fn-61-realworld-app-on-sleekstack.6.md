---
satisfies: [R1, R3]
---
# fn-61-realworld-app-on-sleekstack.6 UI shell and auth pages (login, register, settings)

Touches: apps/realworld/src/app.tsx, apps/realworld/src/main.tsx, apps/realworld/src/pages/**, apps/realworld/test/auth*.test.ts

## Description
Router table and shell: header nav that differs for anonymous and signed-in viewers, footer, 404 page. Login, register and settings pages using `useDraft` and Form Actions with inline error lists, redirect to `/` on success, logout from settings. The viewer is seeded for SSR so server and client render the same nav.

**Size:** M
**Files:** `src/app.tsx`, `src/main.tsx`, `src/pages/{shell,login,register,settings}.tsx`, `src/layers.ts`, `test/auth.test.ts`, `test/hydrate.test.ts`

### Approach
- Follow `apps/showcase/src/pages/model.tsx:36-60` (Draft/DraftSpec) and `src/pages/router.tsx` (route table, startRouter).
- Login/logout invalidate the viewer and viewer-relative queries; query keys include the viewer.
- Redirect protected routes to `/login` when anonymous.
- Verify controlled `<input>`/`<textarea>` typing in `packages/ui/src/jsx-types.ts` first.

### Investigation targets
**Required**:
- `apps/showcase/src/pages/{router,model}.tsx`, `apps/showcase/test/{router,hydrate}.test.ts`
- `packages/query/src/ui.ts`, `packages/router/src/{link,server}.ts`

### Acceptance
- [ ] Register, login, settings update and logout work with `@sleekstack/testing`; server errors render as inline lists; draft survives a failed submit
- [ ] SSR + hydrate of the header for anonymous and signed-in viewers without mismatch
- [ ] Routes needing auth redirect when anonymous

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
