---
satisfies: [R1, R3]
---
# fn-33-head-management-for-ui.3 Head in renderToStream with documented late-change policy

## Description
Stream mode: head tags known at shell flush go in the shell; pick and document the policy for changes after flush (inline patch script with the stream nonce, or per-tag shell-only). `Head` inside `Pending` resolves with its boundary. Record the choice in the new-ADR or docs location the repo uses for decided behavior.

**Size:** M
**Files:** packages/ui/src/stream.ts, packages/ui/src/pending.ts, packages/ui/src/head.ts, packages/ui/src/__tests__/stream.test.ts, docs/adr/ (new ADR)
**Touches:** [packages/ui/src/stream.ts, packages/ui/src/pending.ts, packages/ui/src/head.ts, packages/ui/src/__tests__/stream.test.ts, docs/adr/**]

### Approach
- Follow nonce handling already in `stream.ts`; boundary resolution in `pending.ts` (`BoundaryPath` at line 78).
- Error case: a late change with a policy-excluded tag is ignored deterministically, not thrown.

### Investigation targets
**Required**:
- `packages/ui/src/stream.ts:18-120`
- `packages/ui/src/pending.ts:57-120`
- `docs/adr/` - latest ADR for format

## Acceptance
- [ ] Shell head output matches renderToString for the same tree
- [ ] Late change after flush behaves per documented policy, asserted in a test (R3)
- [ ] Head inside Pending resolves with the boundary
- [ ] ADR written

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
