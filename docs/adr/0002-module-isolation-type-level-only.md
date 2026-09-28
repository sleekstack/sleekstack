# Module exports are descriptive graph metadata — no enforcement

> **Superseded by [ADR 0006](0006-enforce-module-privacy.md).** Module exports are now enforced at graph build and at runtime lookup.

> **Amended.** The original decision below (type-level-only enforcement) has been superseded: `exports` are now purely descriptive. `buildGraph` uses a Module's `exports` only to mark its non-exported entries as `private` on the resulting `GraphSnapshot` node — informational metadata for tooling (e.g. devtools), not a boundary. There is neither a runtime check nor a TypeScript-level restriction on requesting a private Tag from outside its Module; `useService()` and `buildGraph` accept it exactly as they would an exported one.

A Module's private Layers (those not listed in `exports`) are not isolated from consumers by SleekStack. `useService()` does not throw at runtime if a private Tag is requested from outside the Module, and TypeScript does not restrict it either — `exports` only shapes the `private` flag on the graph snapshot.

## Considered options

- **Runtime enforcement**: `LayerProvider` tracks which Tags belong to which Module and throws on unauthorized access. Rejected because it requires SleekStack to maintain provenance metadata for every Tag in the flattened graph, adds meaningful runtime overhead, and duplicates what the snapshot already records descriptively.
- **Type-level only** (originally chosen, now superseded): module `exports` shaped the TypeScript surface visible to consumers while the runtime made no distinction. Rejected on amendment because it added a parallel type-checking surface for a value (`private`) the graph already carries as data, for a guarantee that dynamic Tag usage could bypass anyway.
- **Descriptive metadata only** *(chosen)*: `exports` marks each node's `private` flag in the `GraphSnapshot` (task .3/.9). No compile-time or runtime enforcement. Consumers who need actual isolation get it from module boundaries in their own code (e.g. not re-exporting the Tag), same as any other TypeScript project.
