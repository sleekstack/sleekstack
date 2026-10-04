---
satisfies: [R9]
---
# fn-23-reconciling-dom-renderer-keys-host.10 ui-demo: use key, host onClick and useLocal; demo stays analyzer-clean

Touches: apps/ui-demo/src/components.tsx, apps/ui-demo/test/app.test.ts, apps/ui-demo/test/fixtures.test.ts, apps/ui-demo/test/fixtures/**

## Description
The proving ground (spec R9): real use of all three features, and keys on the existing lists so `MissingKey` stays quiet.

**Size:** M
**Files:** `apps/ui-demo/src/components.tsx`, `apps/ui-demo/test/app.test.ts`, `apps/ui-demo/test/fixtures.test.ts`, `apps/ui-demo/test/fixtures/`
**Touches:** [apps/ui-demo/src/**, apps/ui-demo/test/**]

### Approach
- Add `key` to the three `.map`s in `components.tsx` (`StatusColumn`'s `TaskCard`s, `Columns`' columns, `Team`'s `<li>`s).
- Add a screen with an `<input>` (filter/sort) and a keyed list that reorders, a host `onClick` button, and a `useLocal` toggle (for example a collapsible column header).
- Extend the jsdom test in the style of test 4 ('a filter click re-renders only the columns'): reorder keeps node identity and the input's focus; `Votes` (stateful guest) keeps its count across a re-run; rename the test title that says 'swaps'.
- Add one fixture per new code under `test/fixtures/` (`conditional-slot`, `missing-key`, `event-closure`) and to the `it.each` in `fixtures.test.ts`; the 'demo app itself is clean' test (`errors == []`, `trees.length == 2`) must still pass.
- fn-21's query-driven list with a guest mutation (task .11) must keep working.

### Investigation targets
**Required**:
- `apps/ui-demo/src/components.tsx:46-106,139-172`, `apps/ui-demo/src/guests.tsx`, `apps/ui-demo/src/state.ts`
- `apps/ui-demo/test/app.test.ts:36-69`, `apps/ui-demo/test/fixtures.test.ts:22-28`

### Acceptance
- [ ] jsdom test: keyed reorder keeps DOM node identity and the input's focus; host `onClick` and `useLocal` toggle work; the guest keeps its state across a parent re-run.
- [ ] `fixtures.test.ts` passes with the three new fixtures and the clean-demo assertion.
- [ ] `pnpm --filter ui-demo test` passes.

## Acceptance
- [ ] TBD

## Done summary
Keyed all four mapped lists in ui-demo's components.tsx. Added a Triage screen inside Board: a search input, a sort button and a collapse toggle (useLocal state, host onClick/onInput), with keyed rows that each carry a Votes guest. A jsdom test covers reorder node identity, input focus, guest state and the toggle. Added the conditional-slot, missing-key and event-closure fixtures (event-closure reports UnhandledError). The 'swaps' test title is renamed. Demo is analyzer-clean.

Follow-up (outside Touches): `pnpm --filter ui-demo typecheck` fails with TS2322 on `key` passed to components (components.tsx:54, :81). The cause is that the `JSX` namespace in packages/ui/src/jsx-runtime.ts lacks `interface IntrinsicAttributes { key?: string | number }`.

baseline: red (pnpm --filter ui-demo test: 4 MissingKey, expected per conductor)
stage: impl-review - skipped(config: REVIEW_MODE=none)
Tier: session (jev-unavailable(no_key)); routing block pins implementer opus at medium
## Evidence
- Commits: c1d9860111684fa0ce0a9b7d595b5fc526d1e7a3
- Tests: pnpm --filter ui-demo test
- PRs: