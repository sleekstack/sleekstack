# Query layer follow-ups: kit SSR prefetch, server useMutation

## Goal & Context

Follow-ups left by fn-12 (`@sleekstack/query`). Kept: a kit SSR prefetch facade and showcase-kit hydration; `useMutation` rendering on the server; an `InvalidQueryKey` error code in kit; the optimistic-vs-refetch race. Cut: `fetch(args, previous)` on `Query.make` (only `Query.infinite` uses the in-place `read` replacement, so the `ponytail:` stays), request-scoped lazy server reads (an accepted contract, documented not changed), and literal-union keys in the Analyzer (needs a spec change nobody asked for).

Depends on fn-17: its R2 makes atom hooks work in a server render and edits the same React hook module, and its Snapshot/Serializable Atom terms set the hydrate vocabulary the kit facade must match.

## Architecture & Data Models

- **Kit facade over core Hydrate.** `prefetch` (kit/next), `HydrateQueries` (kit/react) and a codec option on kit cached queries, each mapping through the existing core↔kit query maps. No Effect type is reachable: the codec is a plain `{ encode, decode }` pair (JSON by default), never an Effect Schema. Final names are fixed in the first task against CONTEXT.md and fn-17's terms.
- **Failures normalize.** Codec decode failure and a missing server runner surface as named kit error codes through `normalize`, never `Unknown`.
- **`useMutation` on the server** returns the idle result. Only `useMutation` relaxes; the shared store guard keeps throwing for hooks that cannot work on a server. A mutate call during render (a bug, since handlers never run on the server) still throws a named error.
- **Optimistic recompute rebases on the latest base.** A refetch landing mid-mutation becomes the new base the optimistic layer is recomputed over; it is not overwritten.

## API Contracts

- Kit `prefetch(queries, opts)` and `<HydrateQueries state>` mirror the core Next/React signatures without Effect types.
- Kit query codec option: `{ encode(value): unknown; decode(raw): value }`, default JSON-safe passthrough.
- New kit error code for unserializable query keys (`InvalidQueryKey`).

## Edge Cases & Constraints

- The kit boundary test (no Effect type reachable from kit) must keep passing.
- A lazy server read of an un-prefetched query sees only the configured runtime, not per-call `request`/`overrides` Layers: accepted contract, now stated in the kit docs.
- Any new error code needs a `fix`/`docs` entry once fn-20 lands.

## Acceptance Criteria

- **R1:** Kit exposes a server `prefetch`, a `HydrateQueries` component and a codec option, all Effect-free, named per CONTEXT.md vocabulary. Errors: a codec decode failure and a missing server runner each raise a named kit code (not `Unknown`); a query without a codec fails closed with a message naming the query.
- **R2:** The kit boundary test and `.d.ts` emit check pass with the new exports (no error surface beyond the existing checks).
- **R3:** `apps/showcase-kit` hydrates `board()` from a server prefetch: first server HTML contains the board, no client fetch on first paint, Playwright smoke covers it. Errors: a failed prefetch renders the client-fetch fallback instead of a crash.
- **R4:** `useMutation` returns idle during a server render and the `useBoardMutation` workaround in apps/showcase is deleted; a server render test covers a form with a mutation. Errors: calling `mutate` during render throws a named error.
- **R5:** Unserializable query keys raise a dedicated kit error code instead of `Unknown`, with a test (no other error surface).
- **R6:** A refetch landing mid-mutation no longer discards the optimistic state; the recompute rebases on the refetched base, covered by a deterministic test. Errors: a failed mutation rolls back to the refetched base, not the stale one.
- **R7:** Docs, CONTEXT.md and the errors page describe the kit prefetch facade, the server `useMutation` behavior, the new codes and the lazy-read contract.

## Boundaries

Out of scope: `fetch(args, previous)` hook on `Query.make`; changing the lazy server read contract; literal-union key support in the Analyzer; any atom SSR work (fn-17).

## Decision Context

- Rejected the Schema-based kit codec: Effect types may not leak through kit.
- Rejected relaxing the shared store guard for every hook: only `useMutation` has a meaningful idle server state.
- Rejected adding `fetch(args, previous)`: one internal caller, the `ponytail:` workaround stays.

## Quick commands

```bash
pnpm turbo run test typecheck --filter=@sleekstack/kit --filter=@sleekstack/query --filter=@sleekstack/react
```

## Early proof point

Task fn-16.1 validates the core approach (kit facade maps through core Hydrate without leaking Effect types). If it fails, re-evaluate the codec shape before fn-16.2+.
