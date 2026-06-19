# Module scope isolation is type-level only — no runtime enforcement

A Module's private Layers (those not listed in `exports`) are isolated from consumers at the TypeScript type level only. `useService()` does not throw at runtime if a private Tag is requested from outside the Module. Violations are a compile-time error, not a runtime error.

## Considered options

- **Runtime enforcement**: `LayerProvider` tracks which Tags belong to which Module and throws on unauthorized access. Rejected because it requires SleekStack to maintain provenance metadata for every Tag in the flattened graph, adds meaningful runtime overhead, and duplicates what TypeScript already catches.
- **Type-level only** *(chosen)*: module `exports` shapes the TypeScript surface visible to consumers; the runtime makes no distinction. The cost is that dynamic usage patterns (e.g. tags passed as runtime values) escape enforcement — accepted as an edge case.
