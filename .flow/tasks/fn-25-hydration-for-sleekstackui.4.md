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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
