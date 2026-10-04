## Goal & Context
<!-- scope: business -->

The productize items from the interview: HMR that keeps component state, a generated API reference for `@sleekstack/ui`, and head management (`title`, `meta`, `link`) that works in DOM, SSR and streaming.

## Architecture & Data Models
<!-- scope: technical -->

- HMR: Vite plugin hook swaps component functions; the reconciler re-runs affected instances keeping `useLocal` slots when the slot count matches (SlotMismatch falls back to remount). Function ids are per-function today, so the plugin must preserve identity across module reloads (first task designs this; it is the hard part).
- Docs: extend the existing `generate:api` pipeline in `apps/docs` to cover `packages/ui`; never hand-edit generated files (AGENTS.md).
- Head: a `Head` component collecting into a per-render head collector (Collector pattern); DOM mode patches `document.head` through the reconciler; SSR emits it in the shell; deduplicate by key (`title`, `meta[name]`).

## API Contracts
<!-- scope: technical -->

`<Head>`; docs pages for ui; plugin HMR option.

## Edge Cases & Constraints
<!-- scope: technical -->

Conflicting titles (deepest wins); head in a `Pending` subtree; HMR with a changed hook count.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** Editing a component in a running dev app updates it keeping `useLocal` state and input focus.
- **R2:** A hook-count change remounts that instance instead of throwing.
- **R3:** `generate:api` produces the ui reference and the docs build/tests pass.
- **R4:** `Head` sets title and meta in DOM, in `renderToString` and in streaming output; nested overrides win.
- **R5:** Head tags dedupe by key and are removed when their component unmounts.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=docs`

## Boundaries
<!-- scope: business -->

Not devtools panels, not analytics.

## Decision Context
<!-- scope: both -->

Split into three specs if planning shows the HMR work alone fills one.
