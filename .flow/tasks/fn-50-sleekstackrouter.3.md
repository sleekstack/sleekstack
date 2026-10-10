---
satisfies: [R4, R7, R12, R15]
---
# fn-50-sleekstackrouter.3 Loaders under Pending with serializable transfer

## Description
Loaders under Pending with serializable transfer. Contract and rationale are in the parent spec (R-IDs above).

**Size:** M
**Files:** packages/router/src/loader.ts, the Transfer extension (packages/ui/src/transfer.ts, model on QueryTransferLive in packages/query/src/ui.ts), RenderScope/Collector via ui internals
**Touches:** [packages/router/src/**, tests]

### Approach
- A route's loader is an Effect run under the Pending the router wraps around the page; `useLoader(route)` reads it (suspends like `useSuspenseQuery`); loader data transfers to the client with no refetch; DOM equals between string, stream and hydrate.
- A newer navigation interrupts a pending loader; loader errors reach a route-level Boundary as a tagged error.

## Acceptance
- [ ] Page reads loader data under Pending (R4)
- [ ] String, stream and hydration produce the same DOM (R7)
- [ ] Loader data serializes and transfers without refetch (R12)
- [ ] A typed loader error reaches the nearest `Boundary`; streaming a route with a slow loader sends the shell first (R15)


## Done summary
Added route loaders to @sleekstack/router: `loader(key, schema, effect)`, `useLoader` (reads under Pending, typed errors reach Boundary, one shared load per key+pathname that stops with its last reader) and `LoaderTransferLive` (schema-encoded transfer through ui's Transfer, composes with an outer Transfer such as query's). Tests in packages/router/src/__tests__/loader.test.ts cover string/stream/hydrate DOM parity with no client reload, shell-first streaming, Boundary errors, outer-Transfer carry, and shared-load interruption. @sleekstack/ui is now a required peer of the router.

baseline: green (router gate run pre-edit at fn-50.2 receipt; post-edit gate green)
stage: impl-review - ran (codex fan-out NEEDS_WORK -> single-flight/schema/key/Transfer compose/peer -> NEEDS_WORK shared-load ownership -> SHIP)
Tier: implementer opus at medium
Follow-up: client loader cache has no staleness bound (task 4 prefetch cache / task 5 navigation should own it).
## Evidence
- Commits: 79f89e329892b7a0da405729f1858f4de8479b2c, e1858abe52a1a99ec1463dbde7e1908398036a0f, dd6bed99ccfe43a4e50d2b83bb54ad0e3d1f0765
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/router...
- PRs: