---
satisfies: [R6]
---
# fn-25-hydration-for-sleekstackui.4 ui hydrate: keyed lists, form values, whitespace, focus

## Description
Adopt keyed lists via `flat`/`keysOf`, keep typed input value and focus that exist before hydrate.

**Size:** M
**Files:** packages/ui/src/dom.ts (or hydrate.ts), packages/ui/src/__tests__/hydrate.test.ts
**Touches:** [packages/ui/src/dom.ts, packages/ui/src/hydrate.ts, packages/ui/src/__tests__/hydrate*]

### Approach
- Reuse `flat()`/`keysOf()` so `DuplicateKey` behaves as in mount; recipe for the typed-value test: set `value` on the server node in jsdom before calling `hydrateMount`, then assert value and `document.activeElement`.
- Server `Reactive` wrapper condition must equal the client's (keyed components are always Reactive).

### Investigation targets
**Required** (read before coding):
- `packages/ui/src/dom.ts` keysOf, flat, setProp for FORM value/checked (~l.172-250)

## Acceptance
- [ ] Keyed lists hydrate with node identity preserved; a pre-typed input value and focus survive (R6).
- [ ] Whitespace and adjacent-text cases covered.

## Done summary
Keyed lists already adopted via flat()/keysOf(); added tests for keyed element + keyed component identity and later reorder, DuplicateKey during hydrate, a pre-typed input value + focus surviving (R6), and adjacent/whitespace/empty text. The whitespace test found a bug: an empty text between two texts was reported as a mismatch; fixed in packages/ui/src/hydrate.ts (empty text gets a fresh node unless the current node is an empty text).

baseline: green via handoff (verified at b7a9463 by fn-25.3: ui + ui-demo gate)
Tier: implementer: opus at medium (project routing block)
stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: 9d64703032b96ecbea64eed4bf3179b983338da8
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=ui-demo
- PRs: