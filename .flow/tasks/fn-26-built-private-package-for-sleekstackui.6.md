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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
