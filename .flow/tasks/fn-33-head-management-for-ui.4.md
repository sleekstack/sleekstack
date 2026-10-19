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
`hydrateMount` now takes over the server's head tags instead of copying them (R4). Keyed tags match by key and unkeyed tags (`meta charset`) by equal attributes and text. Adopted tags belong to their `Head` and are removed with it, not restored to the server copy. A server head tag that no client `Head` renders is left in place (the unmatched case; tested in hydrate.test.ts `hydrateMount Head (R4)`). `HeadTarget.add` takes `adopt`, which `Head` reads from `Hydrating` at render time.

Review fixes: a key whose last `Head` leaves now settles in a microtask, so content that takes the key in the same commit keeps the element (identity kept across a fallback-to-content swap). Once hydration installs its landing hook it owns the head, so the stream's `__sleekHead` late patches are dropped, including after dispose. Tests: stream.test.ts `renderToStream late boundaries`, three R4 cases: content takeover keeps the server node, a boundary the client dropped, a disposed mount replaced. README gains a Head section, `onHead` on both renderers, and the stream late-head policy (ADR 0044). apps/docs has no head page, so it is untouched; there is no showcase head fixture.

Tier: implementer opus at medium (actual model: claude-opus-5-5)
stage: impl-review - ran (codex fan-out NEEDS_WORK: 2 findings, a stale late patch after client removal and the adopted node replaced on fallback release; round 2 NEEDS_WORK: patches re-enabled after dispose; round 3 SHIP)
## Evidence
- Commits: 53b5027e58fe842a8e85af3a2f17f010b11b5b56, 2e838d200a3f436ed57ee6874b54c80c24df5663, 50503f436293ad821ae398254ad62f6798d416fc
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui...
- PRs: