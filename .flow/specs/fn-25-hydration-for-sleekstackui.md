## Goal & Context
<!-- scope: business -->

Server HTML from `renderToString` is thrown away on the client today (`mount` re-renders). Production needs hydration: adopt the server DOM, attach listeners and state, no flash, no double render. fn-18 resume stays frozen; hydration replaces the need for it in the main path. The size budget for `@sleekstack/ui` is set after this spec lands (measure, then record in an ADR).

## Architecture & Data Models
<!-- scope: technical -->

- The reconciler's `Live` tree is built from a `Node` plus the DOM it produced; hydration builds `Live` around existing server DOM by walking the first client `Node` tree against it (fn-23 designed this in).
- Server output carries instance markers (`sleek-reactive` hosts already exist; text-node boundaries need markers so adjacent text does not merge) and a serialized atom/Store snapshot for initial values (open question: reuse fn-18 snapshot format or a new one).
- Mismatch policy: on a tag/text mismatch, report `HydrationMismatch` through `onError` and replace that subtree (dev: loud, prod: recover). Never leave server DOM that disagrees with the tree.
- React guests: hydrate through `hydrateRoot` when the guest is rendered on the server (open question: guests server-render today? verify in the first task).
- `useLocal` slots initialise from `initial` on the client, same as the server.

## API Contracts
<!-- scope: technical -->

`hydrate(container, node, options)` beside `mount`; same `onError`, same dispose.

## Edge Cases & Constraints
<!-- scope: technical -->

Whitespace and adjacent text; keyed lists in server output; event closures attach without re-render; a server error boundary fallback; browser-mutated DOM (extensions) triggers mismatch not a crash; double hydrate of one container rejected.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** After `hydrate`, no DOM node from the server HTML is recreated (identity check) when the trees match.
- **R2:** Host `onClick` and `useLocal` work immediately after hydrate, without a second render pass.
- **R3:** A deliberate mismatch reports `HydrationMismatch` and the final DOM equals a fresh client render.
- **R4:** Store/atom state set on the server is the initial value on the client without refetching.
- **R5:** Keyed lists and guests hydrate; focus and typed input present before hydrate survive it.
- **R6:** ui-demo has a server-render-then-hydrate test; a bundle-size measurement is recorded and an ADR sets the budget.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=ui-demo`

## Boundaries
<!-- scope: business -->

Not streaming, not partial/island hydration, not resume.

## Decision Context
<!-- scope: both -->

Depends on fn-23 and the Pending spec (async must be defined before server output can be complete).
