---
satisfies: [R1]
---
# fn-25-hydration-for-sleekstackui.1 ui string: markup parity (instance/guest wrappers, text separators), keep resume green

## Description
Makes `renderToString` emit the structure the DOM renderer builds so the first client tree maps one-to-one onto server DOM. Decision: wrappers are always on; an option exists only if resume tests prove they cannot be.

**Size:** M
**Files:** packages/ui/src/string.ts, packages/ui/src/__tests__/string.test.ts, packages/ui/src/__tests__/resume.test.ts, packages/ui/src/__tests__/dom.test.ts, packages/ui/src/__tests__/reactive.test.ts, apps/ui-demo/test/resume.test.ts
**Touches:** [packages/ui/src/string.ts, packages/ui/src/__tests__/**, apps/ui-demo/test/resume.test.ts]

### Approach
- Reactive emits `<sleek-reactive style="display: contents;">` around its child; Guest emits `<sleek-guest style="display: contents;">` around guest html (apply the `data-sleek-` forgery check to the inner html only); adjacent Text nodes are separated by a comment marker that survives HTML parsing (empty Text is not preserved).
- `Bind` keeps its `<sleek-bind data-sleek-bind>` markup (resume depends on it); hydration handles it in task 2.
- `checkTag` must also reject user-built `sleek-guest` and the separator/payload markup (today only `sleek-reactive`).
- Update the exact-string assertions in string.test.ts (l.12-15, 37, 42, 53, 57, 80, 104-106); if resume.test.ts cannot pass with always-on wrappers, put them behind a renderer option and say so in the task summary.

### Investigation targets
**Required** (read before coding):
- `packages/ui/src/string.ts` serialize (~l.75-120), checkTag (l.17)
- `packages/ui/src/dom.ts` build 'Reactive'/'Guest' (~l.262-290) as the parity target
- `packages/ui/src/__tests__/resume.test.ts` l.38, 126-139
- `.flow/memory/bug/security/guest-markup-can-forge-renderer-owned-2026-10-03.md`

## Acceptance
- [ ] `renderToString` output has the wrappers and text separators; DOM textContent assertions (e.g. dom.test.ts 'ab') still hold (R1).
- [ ] `resume.test.ts` and `apps/ui-demo/test/resume.test.ts` pass.
- [ ] User-built `sleek-guest` and separator markup are rejected like `sleek-reactive`.
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=ui-demo`.

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
