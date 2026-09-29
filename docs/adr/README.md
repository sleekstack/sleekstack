# Architecture Decision Records

| ADR | Decision | Status |
|-----|----------|--------|
| [0001](0001-middle-path-effect-coupling.md) | Middle-path Effect coupling: expose Tags and Layers, hide Runtime and Scope | Accepted, superseded in part by 0004 |
| [0002](0002-module-isolation-type-level-only.md) | Module exports are descriptive metadata, no enforcement | Superseded by 0006 |
| [0003](0003-shadowing-over-explicit-overrides.md) | Overrides are done by shadowing in `provide` | Accepted |
| [0004](0004-hybrid-service-definitions.md) | Hybrid service definitions: runtime metadata alongside raw Effect Layers | Superseded in part by 0010 |
| [0005](0005-dependency-arrays-over-inject.md) | Dependency arrays over `inject()` and params | Superseded by 0010 (actions/queries) |
| [0006](0006-enforce-module-privacy.md) | Module exports are enforced | Accepted, superseded in part by 0010 |
| [0007](0007-fumadocs-with-generated-api-reference.md) | Docs site on Fumadocs, with a generated API reference | Accepted |
| [0008](0008-native-atoms-over-effect-atom.md) | Native atoms, modeled on effect-atom, instead of depending on it | Accepted |
| [0009](0009-next-internal-exit-hook.md) | `@sleekstack/next` exposes an internal Exit hook for adapters | Accepted |
| [0010](0010-static-build-time-dependency-graph.md) | The dependency graph is validated statically, at build time | Accepted |
