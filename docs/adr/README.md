# Architecture Decision Records

| ADR | Decision | Status |
|-----|----------|--------|
| [0001](0001-middle-path-effect-coupling.md) | Middle-path Effect coupling: expose Tags and Layers, hide Runtime and Scope | Accepted, superseded in part by 0004 |
| [0002](0002-module-isolation-type-level-only.md) | Module exports are descriptive metadata, no enforcement | Superseded by 0006 |
| [0003](0003-shadowing-over-explicit-overrides.md) | Overrides are done by shadowing in `provide` | Accepted |
| [0004](0004-hybrid-service-definitions.md) | Hybrid service definitions: runtime metadata alongside raw Effect Layers | Superseded in part by 0011 |
| [0005](0005-dependency-arrays-over-inject.md) | Dependency arrays over `inject()` and params | Superseded by 0011 (actions/queries) |
| [0006](0006-enforce-module-privacy.md) | Module exports are enforced | Accepted, superseded in part by 0011 |
| [0007](0007-fumadocs-with-generated-api-reference.md) | Docs site on Fumadocs, with a generated API reference | Accepted |
| [0008](0008-native-atoms-over-effect-atom.md) | Native atoms, modeled on effect-atom, instead of depending on it | Accepted, amended by 0016 (SSR) |
| [0009](0009-next-internal-exit-hook.md) | `@sleekstack/next` exposes an internal Exit hook for adapters | Superseded by 0012 |
| [0010](0010-islands-over-resumability.md) | Islands defer hydration per React root instead of resumability | Accepted |
| [0011](0011-static-build-time-dependency-graph.md) | The dependency graph is validated statically, at build time | Accepted |
| [0012](0012-next-runtime-management-sugar-in-kit.md) | `@sleekstack/next` manages the Effect runtime; action/query sugar lives in kit | Accepted, superseded in part by 0013 |
| [0013](0013-framework-agnostic-runtime-package.md) | The Effect runtime lives in `@sleekstack/runtime`; `@sleekstack/next` is its Next preset | Accepted |
| [0014](0014-native-query-layer.md) | Queries and mutations are built on native atoms, in `@sleekstack/query` | Superseded by 0018 |
| [0015](0015-host-first-component-framework.md) | `@sleekstack/ui` (MVP spike): the Effect program is the host, React components are guests | Proposed |
| [0016](0016-serializable-atoms-ssr.md) | Atoms render on the server and hydrate from opt-in serializable snapshots | Accepted |
| [0018](0018-tanstack-query-over-native-query-layer.md) | Queries use TanStack Query; `@sleekstack/query` is a thin bridge | Accepted |
| [0019](0019-run-operation-rename.md) | `kit/next`'s inline runner is `runOperation`; `effect` means the side-effect Layer only | Accepted |
| [0017](0017-resumable-host-first-components.md) | `@sleekstack/ui` (spike): host HTML resumes through named handlers and bound atoms without re-running components | Proposed |
| [0020](0020-keyed-instances-skip-unchanged-runs.md) | A keyed instance whose props and context are unchanged is not re-run | Accepted |
| [0021](0021-atoms-bind-in-jsx.md) | An atom in JSX (child or attribute value) binds the DOM directly; the component does not re-run | Accepted |
| [0022](0022-ui-size-budget-and-publish-gate.md) | `@sleekstack/ui` size budget (measured on built output, asserted in a test) and the publish gate; the package stays private | Accepted |
