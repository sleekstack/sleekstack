---
satisfies: [R5]
---
# fn-26-built-private-package-for-sleekstackui.6 size budget measurement, ADR, README

## Description
Measure on built output after hydration landed and record the budget.

**Size:** S
**Files:** apps/ui-demo/test/size.test.ts, apps/ui-demo/src/ (mount and hydrate entries), docs/adr/0020-*.md (check next free number: two 0019 files exist), docs/adr/README.md, packages/ui/README.md
**Touches:** [apps/ui-demo/test/size.test.ts, apps/ui-demo/src/**, docs/adr/**, packages/ui/README.md]

### Approach
- Reuse the ADR 0017 method in size.test.ts (in-process vite build, minify, entry plus static imports gzipped); add entries for mount hello-world, a hydrating app, resume; measure source vs dist; assert limits (absolute from the measurement plus tolerance); verify tree-shaking (a mount-only bundle excludes resume/query).
- ADR records method, numbers, publish gate and `private: true`; README notes two effect copies are unsupported.

### Investigation targets
**Required** (read before coding):
- docs/adr/0017-resumable-host-first-components.md Measured size (~l.23-33)
- apps/ui-demo/test/size.test.ts

## Acceptance
- [ ] Limits are asserted in a test and recorded in the ADR (R5).
- [ ] ADR states the publish gate; package stays private (R5).

## Done summary
apps/ui-demo/test/size.test.ts measures three entries (src/size/mount.tsx, src/size/hydrate.tsx, src/resume/entry.ts) with the ADR 0017 method plus NODE_ENV=production, on dist and on source (aliased): mount 192,781 B gzip (limit 203,000), hydrating app 213,941 (225,000), resume 78,637 (83,000); source vs dist differ by <=3 B. Mount-only bundle verified free of resume and query. ADR 0020 records method, numbers, limits and the publish gate (showcase ported on built packages; pack + size tests green; release process ADR); ui stays private. README Installing section notes the gate. Finding: mount/hydrateMount ship React DOM even without guests (dom.ts static import); lazy guest path deferred. fixtures.test tree count 2 -> 3 (new size entry is an analyzer tree root).

Gates: pnpm turbo run test typecheck build (dist cleaned) 42/42; flowctl validate --all Valid; bench compare all OK.

stage: impl-review - skipped(config: conductor requested no review)
## Evidence
- Commits: bbb09aa54a8fdb4b9bd14663fd4394048ef74946
- Tests: pnpm turbo run test typecheck build, flowctl validate --all, apps/bench: pnpm bench:json && pnpm compare
- PRs: