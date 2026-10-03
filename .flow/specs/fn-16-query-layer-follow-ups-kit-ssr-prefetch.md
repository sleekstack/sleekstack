## Goal & Context
<!-- scope: business -->

Follow-ups left by fn-12 (`@sleekstack/query`), accepted as known gaps.

1. **Kit SSR prefetch.** `@sleekstack/kit` has no server `prefetch`, `HydrateQueries` or Schema codec, so `apps/showcase-kit` fetches its board on the client only. Add an Effect-free facade over the core `Hydrate` API (names decided against CONTEXT.md vocabulary), then make showcase-kit hydrate `board()`.
2. **`useMutation` on the server.** The core `useMutation` throws `AtomsClientOnly` during a server render, so forms cannot server-render; the showcase works around it in `apps/showcase/src/client/services/useBoardMutation.ts`. Make it return idle on the server and remove the workaround.
3. **`fetch(args, previous)` hook in `Query.make`.** `Query.infinite` replaces the family atom's `read` in place (a `ponytail:` workaround in `packages/query/src/infinite.ts`).
4. **Request-scoped lazy server reads** (accepted contract, revisit only if wanted): a lazy server read of an un-prefetched query sees only the configured runtime, not per-call `request` / `overrides` Layers.
5. **Smaller items:** a dedicated SleekStackError code for unserializable query keys (today `Unknown`); a refetch landing mid-mutation is overwritten by the next optimistic recompute (`packages/query/src/mutation.ts`); string-literal union key parameters fail closed in the Analyzer (spec says unions fail closed; allowing literal unions needs a spec change).

## Requirement coverage
<!-- scope: technical -->

Not yet planned. Run `/flow-next:plan` on this spec.
