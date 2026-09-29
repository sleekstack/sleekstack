# Module exports are enforced — private Tags are visible only inside their Module

Superseded in part by [ADR 0010](0010-static-build-time-dependency-graph.md): `PrivateDependency` is reported by the analyzer at build time instead of `buildGraph`; the filtered public Context and resolve-time `PrivateDependency` remain.

Supersedes [ADR 0002](0002-module-isolation-type-level-only.md).

When a Module lists `exports`, every other Tag it provides is private: only the Module's own entries may require it. `buildGraph` rejects an outside node requiring a private Tag with a tagged `PrivateDependency { tag, module, requiredBy }`. At runtime a scope's public `context` omits private Tags, and consumers (`useService`, kit action/query deps, child scopes and per-call `provide` entries) report the same `PrivateDependency` instead of "not provided". Omitted `exports` keeps every Tag public, so existing apps keep working. Shadowing a private Tag from outside (providing the same Tag more locally) is not a reach-in: it is a new public provider.

## Considered options

- **Descriptive metadata only** (ADR 0002): rejected — a `private` flag nobody honours gives no boundary, and apps silently couple to a Module's internals.
- **Type-level only**: rejected — dynamic Tag usage bypasses it and it duplicates graph data.
- **Graph + runtime enforcement** *(chosen)*: the graph already carries per-Tag provenance, so the check is a lookup, not new bookkeeping. Scopes keep a full inner context for nested builds and expose a filtered one plus a `Privacy` Tag that lets consumers explain a miss.
