---
satisfies: [R7, R8, R9]
---
# fn-51-showcase-one-app-for-all-of-sleekstackui.3 Showcase demos: typed DOM, lazy, forms, transitions

## Description
Add shell-linked demo pages in apps/showcase: typed host elements, lazy with Boundary retry, form actions (useAction/useFormStatus/useOptimistic with Effect Schema), startTransition and useDeferredAtom; each with a test and wired into SSR/hydration/resume where supported. **Touches:** apps/showcase/**

## Acceptance
- R7 (typed DOM, lazy, forms, transitions) and R8 hold for these demos
- architecture, size and check stay green

## Done summary
The showcase shell now has a page nav (`pages/shell.tsx`, each page opens in a `startTransition`) and an outlet. It links four pages: the board, typed host elements (`pages/dom.tsx`), `lazy` (`pages/lazy.tsx` with `pages/chart.tsx` as its own chunk) and transitions (`pages/transitions.tsx`). The new-task form gained `useOptimistic` on top of its existing `useAction`/`useFormStatus`/Schema decode. `TaskRepoLive.add` has a simulated 300 ms round trip, so the optimistic title is visible. The resume counter gained a resumable form action (`resume/set.ts`).

Each demo has tests covering mount, `renderToString` and `hydrateMount`:
- `test/dom.test.tsx`: also pins four tsc errors.
- `test/lazy.test.ts`: `vi.mock` fails the chart's first import, then Retry loads it.
- `test/transitions.test.ts`: transition vs ordinary tab switch, deferred commit order, SSR and hydrate.
- `test/app.test.ts`: shell nav with the transition hold, the optimistic add, and the query field agreeing after navigation.
- `test/hydrate.test.ts`: form submit after hydration.
- `test/resume.test.ts`: resumed form action.

The ADR 0022 resume row was remeasured at 307,040 B min and 79,447 B gzip, with lazy handlers at 229 B, under the 83,000 B limit. The other size entries did not move. `sleekstack check` reports no diagnostics, and the analyzer tree count is still 4.

Changed route: the board is now the shell's default "Board and forms" page; the project switcher sits inside it.

Follow-ups (not built):
- Package bug, left alone because of R11: `hydrateMount` adopts an atom-bound text child such as `<output>{atom}</output>` but never subscribes it, so it stays at the server value. `mount` and `resume` do update it. The cause is the `Bind` case of `adoptOne` in `packages/ui/src/hydrate.ts`. The DOM demo binds atoms to attributes only for this reason.
- The page cannot simulate a failed `lazy` import, because the analyzer only reads a literal `lazy(() => import('...'))`. The retry path is shown by the test's mock.
- `showcases.mdx` and the app README do not list the new pages yet (task 4 owns R10).

Tier: implementer opus at medium (actual_model: claude-opus-5-5)

baseline: green (pnpm turbo run test typecheck --filter=showcase; sleekstack check clean, pre-edit)

stage: impl-review - ran (codex fan-out, base master: correctness SHIP, contracts NEEDS_WORK (1 finding: uncontrolled query input), integration SHIP; fixed in 7bfc956; re-review SHIP)
## Evidence
- Commits: 7f36616b6c0a61aef83919f181f028185c583656, 7bfc956981e6925d703380de6ddff084a029a45b
- Tests: pnpm turbo run test typecheck --filter=showcase, sleekstack check (apps/showcase)
- PRs: