---
satisfies: [R4]
---
# fn-59-docs-build-platform-on-ui-and-start.2 ui: Head in streams and hydration adopts server head tags

## Description
Finish the head contract: a head change after the stream shell has flushed follows one documented policy, and hydration adopts the server's head tags without duplicating them.

**Size:** M
**Files:** packages/ui/src/stream.ts, hydrate.ts, head.ts, tests in packages/ui/src/__tests__/ (stream, hydrate, head)
**Touches:** [packages/ui/src/**]

### Approach
- Stream policy (fn-33 task 1 picks and documents one): a title or meta that changes after the shell flushed is emitted as an inline patch script carrying the stream nonce, or marked shell-only per tag. `Head` inside a `Pending` subtree is covered by the same rule.
- Hydration adopts head tags by key, never duplicates them, and reports a mismatch like the rest of the hydrate walk.
- Record the chosen policy in the task summary for the ADR in the records task.

### Investigation targets
**Required**:
- `packages/ui/src/stream.ts`, `hydrate.ts` (the walk and `__sleekSwap` wrapper)
- `packages/ui/src/head.ts` (from task 1)
- `docs/adr/0023-*.md`, `docs/adr/0016-*.md`
- `.flow/specs/fn-33-head-management-for-ui.md`
**Optional**:
- `packages/ui/src/__tests__/hydrate.test.ts`, `stream.test.ts`

## Acceptance
- [ ] A head change after the shell flushed follows the documented policy, shown by a test, including inside a `Pending` subtree
- [ ] Hydrating a page with server head tags leaves exactly one of each tag and no `HydrationMismatch`
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=showcase` is green

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
