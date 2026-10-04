## Goal & Context
<!-- scope: business -->

Server HTML from `renderToString` is thrown away on the client today (`mount` re-renders). Production needs hydration: adopt the server DOM, attach listeners and state, no flash, no recreated DOM. fn-18 resume stays frozen and its tests must keep passing. The size budget is NOT set here (see fn-26).

## Architecture & Data Models
<!-- scope: technical -->

Verified: `sleek-reactive` and `sleek-guest` hosts exist only in the DOM renderer (`dom.ts`). `string.ts` serializes a `Reactive` node as its bare child, guests with no wrapper, and adjacent text unseparated. Guests already render on the server (`string.ts`).

- **Markup parity.** `renderToString` emits the same `sleek-reactive` / `sleek-guest` wrappers and text separators the DOM renderer creates, so the first client `Node` tree maps one-to-one onto server DOM. This changes `renderToString` output; resume parses that output, so `resume.test.ts` must pass with the new markup, or the wrappers sit behind a renderer option that hydration-targeted output turns on (task 1 picks; default: always on if resume still passes, else the option). A `sleek-guest` wrapper is required, since `hydrateRoot` needs its own container per guest.
- **Live tree around server DOM.** `Live` is built from a `Node` plus DOM; hydration walks the first client `Node` tree against existing DOM and builds `Live` around it (fn-23 designed this in). Components each run once on the client to rebuild handlers, `useLocal` slots and event closures; no DOM is created for matching nodes.
- **State.** No new snapshot format. Atom state uses core `dehydrate`/`hydrate` with `Atom.serializable` (ADR 0016); query state uses query's `Dehydrated`/`HydrateQueries` (ADR 0014/0018). The serialized payload is embedded in the HTML by `renderToString` and read by `hydrate`.
- **Naming.** A ui-level `hydrate` collides with core's `hydrate(store, snapshot)`. Name the ui function `hydrateRoot`-style (`hydrateMount`; final name checked against ADR 0019 and `exportNames.test.ts`).
- **Mismatch policy.** On a tag/text mismatch report `HydrationMismatch` through `onError` and replace that subtree. Cases: non-deterministic render (time, random), a client Layer that differs from the server Layer, a `Boundary` fallback that rendered on the server but succeeds on the client, browser-mutated DOM.
- **Forward hook for fn-27.** `Pending` boundaries whose content is not yet present are skipped and adopted when the content arrives; the shape is defined here, the arrival mechanism in fn-27.
- **Resume manifest.** If a resume manifest is present hydration ignores it (resume stays frozen).

## API Contracts
<!-- scope: technical -->

`hydrateMount(container, node, options)` beside `mount`; same `onError` and dispose.

## Edge Cases & Constraints
<!-- scope: technical -->

Whitespace and adjacent text; keyed lists; event closures attach without re-render; double hydrate of one container rejected; guest roots hydrate via React `hydrateRoot`.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `renderToString` output contains the instance and guest wrappers and text separators; `resume.test.ts` passes. Errors: none beyond a resume break, which fails the task.
- **R2:** After hydrate with matching trees, no server DOM node is created or replaced (identity check) and each component runs exactly once. Errors: a double hydrate of one container fails with a tagged error.
- **R3:** Host `onClick` and `useLocal` work immediately after hydrate. Errors: a closure failure goes to `onError`.
- **R4:** A deliberate mismatch reports `HydrationMismatch`, and the final DOM equals a fresh client render. Errors: non-deterministic render and differing client Layer are covered by tests.
- **R5:** Atom and query state set on the server is the initial value on the client without refetch. Errors: a missing or malformed payload falls back to client initial values and reports.
- **R6:** Keyed lists and guests hydrate; a value typed into an input before hydrate (set on the server node in jsdom) and its focus survive. Errors: none.
- **R7:** ui-demo has a server-render-then-hydrate test; ADR 0015 amended.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=ui-demo`

## Boundaries
<!-- scope: business -->

Not streaming, not partial/island hydration, not resume, not the size budget.

## Decision Context
<!-- scope: both -->

Depends on fn-23 and fn-24 (async must be defined before server output is complete). Reuses ADR 0016 and query dehydration instead of a third format.
