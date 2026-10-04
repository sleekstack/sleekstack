## Goal & Context
<!-- scope: business -->

HMR that keeps component state. Split out of the original productize spec (head management is fn-33, the API reference is fn-34).

## Architecture & Data Models
<!-- scope: technical -->

- Verified problem: `fnId` is a per-function counter in a `WeakMap`, and `frame.ordinals` is keyed by the function (`reactive.ts`), so a reloaded module gets new ids and every instance remounts.
- Stable ids come from the Vite plugin (fn-29 R5: file path + export name). On a module update the plugin swaps the component function; the reconciler re-runs affected instances keeping their `useLocal` slots when ids match.
- `SlotMismatch` today fails the run into `onError`. For HMR, a hook-count change after a hot update must remount that instance instead: this is a renderer change (an explicit "hot update" mode in `reactive.ts`/`dom.ts`), not just a plugin one.
- Falls back to full reload for modules that are not component-only.

## API Contracts
<!-- scope: technical -->

Plugin option `hmr: boolean` (default on in dev); a small runtime `acceptUpdate(id, fn)` used by the transform.

## Edge Cases & Constraints
<!-- scope: technical -->

Hook count changes, keyed lists during update, guest components (React Fast Refresh owns those), a component that throws after an update (keeps the old function and reports).

## Acceptance Criteria
<!-- scope: both -->

- **R1:** Editing a component in a running dev app updates it keeping `useLocal` state and input focus. Errors: a throwing update keeps the previous function and reports the error.
- **R2:** A hook-count change remounts that instance instead of failing with `SlotMismatch`; outside HMR `SlotMismatch` is unchanged.
- **R3:** A non-component edit triggers a full reload.
- **R4:** React guests keep using React Fast Refresh and are not affected.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=@sleekstack/ui-vite...`

## Boundaries
<!-- scope: business -->

No devtools panel, no production HMR.

## Decision Context
<!-- scope: both -->

Depends on fn-29 (stable ids). Last in the roadmap.
