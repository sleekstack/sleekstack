---
satisfies: [R1, R2, R3, R11, R12, R13]
---
# fn-49-portals-and-boundary-reset.2 Portal node across renderers

## Description
Portal node across renderers. Contract and rationale are in the parent spec (R-IDs above).

**Size:** M
**Files:** packages/ui/src/node.ts (Node union), jsx-runtime.ts, dom.ts (build, patch, drop, as GuestBoundary precedent), hydrate.ts (adopt builds fresh), string.ts (emit nothing), stream.ts, resume.ts, packages/analyze/src/components.ts (transparent like Fragment)
**Touches:** [packages/ui/src/node.ts, packages/ui/src/jsx-runtime.ts, packages/ui/src/dom.ts, packages/ui/src/hydrate.ts, packages/ui/src/string.ts, packages/ui/src/stream.ts, packages/ui/src/resume.ts, packages/analyze/src/components.ts, tests]

### Approach
- Children are built into the container with the current env and scopes, so Layers and Store flow through as for any node; drop removes that DOM; patch must not assume the Live's parent for insertion.
- Hydration: the server has no portal DOM, so adopt builds fresh and reports no mismatch. Container missing or detached: typed error. Tests prove Layers/Store inside a portal in DOM, string and hydration (fn-39.D1 deferred this measurement to build).

## Acceptance
- [ ] Children render into the container with the surrounding Layers and Store (R1, R2)
- [ ] Content removed with the portal or its owner (R3)
- [ ] Missing container is a typed error; all renderers and the analyzer handle Portal; portal handlers are client-only (R11, R12, R13)


## Done summary
`<Portal container={el}>` renders its children into `el` inside its own `<sleek-portal>` host, with the Layers and Store of where it appears; the host attaches on commit and goes with the portal or its owner. A missing or detached container (at build or a later patch) reports `PortalContainerMissing`. The string and stream renderers emit nothing, so portal handlers are client-only; hydration builds portals fresh without a mismatch; the analyzer treats Portal as transparent. Tests: packages/ui/src/__tests__/portal.test.ts, analyzer fixture ui-portal.

Tier: implementer opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK -> SHIP, round 2)
## Evidence
- Commits: 0aa8b3c1dcefde66cc475081b28f3b389da3c1d9, 237cb1e660d1babfed43d0bd75ffc60c94686e8d
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=@sleekstack/analyze --filter=sleekstack
- PRs: