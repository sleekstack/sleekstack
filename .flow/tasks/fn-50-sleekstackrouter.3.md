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


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
