---
satisfies: [R2, R3]
---
# fn-25-hydration-for-sleekstackui.2 ui dom: hydrateMount adopt-walk spike (proof point)

## Description
Early proof point. Adds `hydrateMount` beside `mount`: runs the app once, then walks the first client Node tree against existing server DOM, building `Live` around it with no DOM recreated.

**Size:** L
**Files:** packages/ui/src/dom.ts (or packages/ui/src/hydrate.ts new), packages/ui/src/index.ts, packages/ui/src/__tests__/hydrate.test.ts (new)
**Touches:** [packages/ui/src/dom.ts, packages/ui/src/hydrate.ts, packages/ui/src/index.ts, packages/ui/src/__tests__/hydrate*]

### Approach
- Share mount's front half (states/gen, store, scope, frame, runToNode) and replace only the `patchChildren` step with an adopt-walk; skip mount's `container.replaceChildren()` teardown on first adopt, and hang the double-hydrate guard (tagged error) off the per-container `states`/`gen`.
- Adopt elements, text (skipping separator comments), Reactive, Guest wrappers and `sleek-bind` (map a `sleek-bind` element to its text, since hydration and resume are exclusive); attach host events via `listen`; apply `checkTag`/`checkAttr` on adoption too.
- Name: `hydrateMount` (free in ui; core owns `hydrate`/`dehydrate`/`Snapshot`).
- Never overwrite a user-modified `.value`/`checked` on adopt.

### Investigation targets
**Required** (read before coding):
- `packages/ui/src/dom.ts` mount (~l.524-560), patchChildren (~l.366), flat (~l.172), keysOf (~l.184), listen/relisten, teardown/states (~l.119)
- `packages/ui/src/string.ts` for the markup it must match

## Acceptance
- [ ] After hydrating a matching tree, no server DOM node is created or replaced (identity check) and every component runs exactly once (R2).
- [ ] Host `onClick` and `useLocal` work immediately (R3).
- [ ] A second hydrate on one container fails with a tagged error; `mount` then `hydrateMount` on the same container is defined and tested.

## Done summary
Added `hydrateMount` (packages/ui/src/hydrate.ts) sharing mount's front half through a new `start()` in dom.ts: it runs the app once and adopts the server DOM (elements, text with separator comments removed, sleek-reactive instances with watch, sleek-guest hosts, sleek-bind unwrapped to its text node), attaching listeners via `listen` and running checkTag/checkAttr, never touching attributes or form value/checked. `HydrateConflict` (tagged) rejects hydrateMount on any container already mounted or hydrated, before the app runs; `mount` after `hydrateMount` replaces as usual. Tests in __tests__/hydrate.test.ts: node identity + one run per component + onClick/useLocal, double hydrate, mount-then-hydrate, bind unwrap.

Spike shortcuts for later tasks (marked `ponytail:`): mismatch replaces the node and reports a plain defect (fn-25.3), extra server nodes removed silently (fn-25.3), guests use createRoot so React re-renders guest content (fn-25.5).

baseline: green via handoff (verified at aac1aea by fn-25.1)
Tier: implementer: opus at medium (project routing block)
stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: 135f42974a6ce37c190afcb3c9a6e69af16f52ff
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=ui-demo
- PRs: