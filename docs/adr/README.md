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
| [0017](0017-resumable-host-first-components.md) | `@sleekstack/ui` (spike): host HTML resumes through named handlers and bound atoms without re-running components | Proposed |
| [0018](0018-tanstack-query-over-native-query-layer.md) | Queries use TanStack Query; `@sleekstack/query` is a thin bridge | Accepted |
| [0019](0019-run-operation-rename.md) | `kit/next`'s inline runner is `runOperation`; `effect` means the side-effect Layer only | Accepted |
| [0020](0020-keyed-instances-skip-unchanged-runs.md) | A keyed instance whose props and context are unchanged is not re-run | Accepted |
| [0021](0021-atoms-bind-in-jsx.md) | An atom in JSX (child or attribute value) binds the DOM directly; the component does not re-run | Accepted |
| [0022](0022-ui-size-budget-and-publish-gate.md) | `@sleekstack/ui` size budget (measured on built output, asserted in a test) and the publish gate; the package stays private | Accepted |
| [0023](0023-streaming-ssr-protocol.md) | `@sleekstack/ui` streaming SSR: comment placeholders, template chunks swapped by an inline runtime, `b` map, `__sleekEnd`, `nonce`, distinct `idPrefix` per stream | Accepted |
| [0024](0024-generator-components.md) | A component may be a `function*` that `yield*`s Effects and returns its element; the framework runs it as `Effect.gen` | Accepted |
| [0025](0025-ui-does-not-depend-on-query.md) | `@sleekstack/ui` has no dependency on `@sleekstack/query`: SSR state travels through a `Transfer` service, the query bindings live in `@sleekstack/query/ui` | Accepted |
| [0026](0026-plain-event-handlers.md) | Event handlers: a function, a generator or an Effect | Accepted |
| [0027](0027-use-effect.md) | `useEffect`: an effect tied to an instance, re-run when its deps change | Accepted |
| [0028](0028-commit-effects-and-refs.md) | Effects run after the DOM commit; `useRef` and the `ref` prop | Accepted |
| [0029](0029-generator-effects.md) | Generator effects follow the atoms they read, no `deps` needed | Accepted |
| [0030](0030-derived-atom-hook.md) | `useDerivedAtom`: a derived atom in the component's context | Accepted |
| [0031](0031-typed-host-elements.md) | Host JSX elements are typed per tag: attributes, `on*` events and `ref`; `class` canonical, `className` accepted | Accepted |
| [0032](0032-component-testing-package.md) | `@sleekstack/testing`: Vitest + jsdom, Testing Library queries, disposal on global `afterEach`, DOM-quiet `flush` | Accepted |
| [0033](0033-form-actions.md) | A form `action` is a submit handler that gets the form's data; latest submit wins | Accepted |
| [0034](0034-transitions-and-deferred-atoms.md) | `startTransition` and `useDeferredAtom` without concurrent lanes: a marked write keeps the previous DOM over a new `Pending`; a deferred atom follows its source after the commit | Accepted |
| [0035](0035-boundary-instance-reset.md) | `Boundary` is an instance; its fallback receives `reset`, which re-runs the failed subtree. `Portal` renders into another container in its owner's context | Accepted |
| [0036](0036-router-const-route-table.md) | `@sleekstack/router`: a const route table with params inferred from path strings, no TanStack router-core, no codegen | Accepted |
