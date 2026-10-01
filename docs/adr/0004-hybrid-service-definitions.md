# Hybrid service definitions: runtime metadata alongside raw Effect Layers

**Amended 2026-10-01:** core no longer exports `service()` — core is Effect-native only and kit alone owns Effect-hiding helpers; kit's `layer()` lowers to `declareLayer()`. **Amended again 2026-10-01:** `declareLayer()` no longer takes `provides`/`requires`; the Analyzer reads them from the Layer type and the runtime keeps no graph (entries build in position order). The rest of this ADR describes the original decision.

Superseded in part by [ADR 0011](0011-static-build-time-dependency-graph.md): `service()` metadata remains, but the graph is validated statically by the analyzer, not at run time.

`@sleekstack/core` exports `service()`, a helper that produces an Effect `Layer` plus runtime metadata (the provided Tag, the required Tags, and a lifetime). Raw Effect `Layer`s are still accepted directly — bare (self-contained, opaque to the graph) or declared via `declareLayer()` (wrapped with the Tags it provides/requires, becoming a full graph node). This supersedes [ADR 0001](0001-middle-path-effect-coupling.md)'s "core exports only `module()`".

## Considered options

- **`module()` only, no metadata** (ADR 0001 as originally written): rejected — a Layer's requirements exist only at the type level, so the engine cannot derive construction order, produce a missing-dependency error naming the requiring service and Tag, or check lifetime safety at runtime. The spike (task .2) measured this directly: without metadata there is no readable `MissingDependency`/`DependencyCycle`, no Kahn ordering, and no runtime `CaptiveDependency` check.
- **Hand-maintained dependency list separate from types**: rejected — drifts silently from the Layer's actual requirement type as the codebase changes.
- **Hybrid: `service()` carries metadata, raw Layers still accepted** *(chosen)*: `service(tag, { requires, lifetime }, make)` derives the Layer's requirement type from `requires`, so metadata and types cannot drift. Raw Layers remain first-class (bare as an opaque base, declared as a full node), so users are never forced through the helper for Layers they already own.
