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
renderToString now wraps Reactive output in `<sleek-reactive style="display: contents;">` and guest html in `<sleek-guest style="display: contents;">` (forgery check still on inner html), and separates adjacent Text nodes, flattened across fragments, with `<!--sleek-t-->` (exported as TEXT_SEPARATOR). Resume tests pass with the wrappers, so they are always on and no option was added. checkTag rejects user-built sleek-guest too. Separator comments can't be built by users, and payload attributes are already blocked by the data-sleek- rule. Tests: string.test.ts separator case, reactive.test.ts parametrized reserved-tag rejection, updated exact-string assertions.

Tier: implementer: opus at medium (project routing block)
stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: 743d6be870b1ad71bd85fb142733a3d33972f32c
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=ui-demo, baseline: green via handoff (full pnpm turbo run test typecheck 33/33 at the fn-24 tip)
- PRs: