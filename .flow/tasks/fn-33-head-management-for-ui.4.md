---
satisfies: [R4]
---
# fn-33-head-management-for-ui.4 Hydration adopts server head tags, docs

## Description
Hydration adopts existing server head tags as the initial `HeadSink` entries (no duplicates), then DOM patching takes over. Include docs for `Head` and the fixture/showcase touch if one exists.

**Size:** M
**Files:** packages/ui/src/hydrate.ts, packages/ui/src/head.ts, packages/ui/src/__tests__/hydrate.test.ts, packages/ui/README.md
**Touches:** [packages/ui/src/hydrate.ts, packages/ui/src/head.ts, packages/ui/src/__tests__/hydrate.test.ts, packages/ui/README.md]

### Approach
- Follow adoption of existing nodes in `hydrate.ts` (checkAttr use at line 181).
- Error case: a server tag with no matching client entry is removed on first reconcile or left untouched per key; pick one and test it.

### Investigation targets
**Required**:
- `packages/ui/src/hydrate.ts:150-220`
- `packages/ui/src/__tests__/hydrate.test.ts` - style
- `apps/docs/content/docs` - check whether ui docs live here

## Acceptance
- [ ] Hydrating a server-rendered head yields no duplicate tags (R4)
- [ ] Unmatched server tag case tested
- [ ] README documents Head and the stream policy
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui...` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
