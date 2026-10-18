---
satisfies: [R1]
---
# fn-33-head-management-for-ui.2 Head in renderToString

## Description
SSR mode of `HeadSink`: collect tags during `serialize`, expose the head string via `renderToString` options/return; same dedupe and deepest-wins as DOM.

**Size:** S
**Files:** packages/ui/src/string.ts, packages/ui/src/head.ts, packages/ui/src/__tests__/string.test.ts
**Touches:** [packages/ui/src/string.ts, packages/ui/src/head.ts, packages/ui/src/__tests__/string.test.ts]

### Approach
- Extend `renderToString` (`string.ts:186`) following how the `Collector` interface (`string.ts:39`) is threaded.
- Attribute values escaped with `escape`; invalid attrs throw via `checkAttr`.

### Investigation targets
**Required**:
- `packages/ui/src/string.ts:39-60,134-200`

## Acceptance
- [ ] Head string includes title/meta/link, nested override wins
- [ ] Escaping and invalid-attr rejection tested

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
