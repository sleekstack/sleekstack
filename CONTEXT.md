# SleekStack

A runtime architecture layer that adds structured dependency management, React-scoped service graphs, and request-scoped server environments on top of React, Next.js, and Effect TS.

## Language

### Service graph concepts

**Tag**:
An Effect `Context.Tag<T>` that uniquely identifies a service within the runtime. Users define tags using Effect's API directly; SleekStack does not wrap them.
_Avoid_: Token, ServiceTag, identifier, key

**Layer**:
An Effect `Layer` that describes how to construct one or more services, including their resource acquisition and cleanup. Users write layers using Effect's API directly; SleekStack does not wrap them.
_Avoid_: Provider, factory, ServiceProvider

**Service**:
The resolved runtime value obtained by providing a Tag to `useService()`. Distinct from the Tag (the identifier), the Layer (the constructor), and the Declared Layer (a Layer plus its lifetime).
_Avoid_: Instance, dependency, singleton

**Declared Layer**:
The output of `declareLayer(layer, { lifetime? })` — a plain Effect Layer plus its Lifetime. What it provides and requires is read from the Layer's type by the Analyzer; the runtime keeps no such metadata. Core has no Effect-hiding builders: everything it accepts is a Layer. Only `@sleekstack/kit` hides Effect (`layer()`, `effect()`), and lowers to Declared Layers.
_Avoid_: Service Definition, `service()`, provider definition

**Lifetime**:
One of `app`, `request`, or `component` — how long a constructed service lives before it is finalized. Constrains which lifetimes may depend on which (the lifetime matrix: `app` on `app`; `request` on `app`+`request`; `component` on `app`+`component`; `request` and `component` never nest).
_Avoid_: Scope kind, duration, lifecycle tier

**Module**:
A named group of entries — declared Layers or bare Layers — with imports (other Modules, pulled in transitively) and exports. Exports are enforced: when `exports` is given, every other Tag the Module provides is private and may be required only by the Module's own entries — importers, root entries, `useService`, action/query deps, per-call `provide` entries and child scopes get `PrivateDependency` from the Analyzer (the runtime does not enforce it). Omitted `exports` means all public. Shadowing a private Tag from outside provides a new public one (ADR 0006). The primary architectural unit in SleekStack. Created with `module()`.
_Avoid_: Package, bundle, plugin, feature

**Graph**:
The dependency structure of every entry and imported Module under a root (a `configureRuntime` app root, or a Request Root or Overrides Root): nodes, edges, lifetimes, module privacy and shadowing. Validated only by the Analyzer, at build time (ADR 0011); `sleekstack check --json` reports it (one node per provided Tag, keyed by the Tag key, or `Tag@Module` when shadowed). The runtime keeps no Graph at all: it builds entries in position order (deepest import first, root entries last), so a later, more local entry overrides an earlier one.
_Avoid_: Dependency tree, container, registry

**Captive Dependency**:
A lifetime-safety violation where a longer-lived entry would depend on a shorter-lived one (e.g. `app` on `request`), which would otherwise capture a stale or already-finalized instance. Reported by the Analyzer per the lifetime matrix, naming both services and their lifetimes.
_Avoid_: Lifetime leak, scope violation

### Kit facade concepts

**Kit**:
`@sleekstack/kit`, the Effect-free facade over core, runtime, next and react. It lowers every call to the core API; no Effect type is reachable from its public entries.
_Avoid_: Wrapper, lite, simple API

**Kit Tag**:
A service token created by `tag<T>(name)`, or an (abstract) class used directly as a Tag. Maps to a core Tag keyed by the name.
_Avoid_: Token, key

**Kit Layer**:
The output of `layer(tag, impl, deps?, { lifetime }?)`: `impl` is a value, a class, or a (sync or async) factory whose parameters are the resolved services of the `deps` array, in order. Or `layer(tag, function* () { ... }, { lifetime }?)`: a generator factory whose `yield*`ed Tags are its requirements, resolved lazily and memoized per scope (ADR 0011). Returning `withCleanup(service, cleanup)` registers a finalizer. Lowers to a Service Definition.
_Avoid_: Provider, factory, binding

**Kit Effect**:
The output of `effect(fn, deps?, { name, lifetime }?)` from `@sleekstack/kit`: a side effect with no service to expose. `fn(...deps)` runs when its scope opens; the function it returns runs when the scope closes. Graph rules (missing, captive, private) apply to its deps; it appears in the Graph as `effect:<name>`. Not the same as `effect(gen, opts?)` from `@sleekstack/kit/next`, which runs a Kit Operation inline.
_Avoid_: Hook, job, init

**Kit Operation**:
An action or query from `@sleekstack/kit/next`: `defineEffect(gen, opts?)` / `defineQuery(gen, opts?)`, or `effect(gen, opts?)` / `query(gen, opts?)` run inline. Its deps are the Tags the generator `yield*`s (followed through helper generators), resolved from the Request Scope on demand; there is no deps array. `opts.provide` shadows the Graph for one call; `opts.scope: [Tags]` builds Tags the body never yields (e.g. `RequestContext`) and counts them as edges.
_Avoid_: Handler, deps array

**Analyzer**:
`@sleekstack/analyze`, run as `sleekstack check [--project <tsconfig>] [--entry <file>...] [--json] [--lenient]`. Reads the declarations through the TypeScript checker without executing app code, builds each root's Graph and reports every violation with file:line (exit 0 ok, 1 violations, 2 crash or no roots). Fails closed: a declaration it cannot read is an error. `--entry` limits the roots to the given files. `--lenient` turns an unresolvable `runEffect` Layer into an opaque root (`kind: 'opaque'`) instead of an error; it never excuses a missing Tag or an unresolvable app Layer.
In a project whose package.json lists `@sleekstack/ui`, `sleekstack check` also runs the component pass (`analyzeComponents`): one tree per `mount` call, reporting `MissingDependency`, `UnhandledError`, `EffectInsideReact` and `Unresolved` (`components` under `--json`).
_Avoid_: Linter, compiler plugin

**Request Root**:
A Graph root made from the `request` Layer of a `runEffect({ request })` call (each Layer-valued branch is its own root). Checked against its own provides plus any `configureRuntime` app root, so needing an app singleton is not a missing dependency; its leaves have lifetime `request`. Reported with `kind: 'request'`; app roots are listed first with `kind: 'app'`.
_Avoid_: Request graph, sub-graph

**Overrides Root**:
A Graph root made from the `overrides` Layer of a `runEffect({ overrides })` call, checked like a Request Root but keeping its typed lifetimes. Reported with `kind: 'overrides'`.
_Avoid_: Override graph, patch layer

**Position Order**:
Core's construction order for a scope: entries flattened deepest import first, then importers, then root entries; each builds over what was built before and a later one overrides an earlier one. Nothing is validated; a Layer that needs a Tag not built yet fails with `MissingDependency`. Kit sorts each `provide` list by its `deps` arrays first, so list order only matters for core Layers and kit generator Layers (their yields are not declared).
_Avoid_: Resolution Plan, Graph, snapshot

**SleekStackError**:
The one public error type of the kit: every core tagged error, kit check (`DuplicateTag`, `InvalidTag`) and thrown value is normalized to it, with a `code` and `details`.
_Avoid_: KitError, GraphError

### React integration concepts

**LayerProvider**:
A React component that creates a runtime scope and makes a set of Layers and Modules available to its subtree via the `provide` prop. Nested LayerProviders inherit from their parent scope, resolve Module imports (including thunks), and finalize before their parent. Acquisition suspends on first use and is StrictMode-safe via deferred dispose.
_Avoid_: ServiceProvider, ScopeProvider, ContextProvider

**Scope**:
An Effect `Scope` managed internally by a LayerProvider. Finalizes all acquired resources when the LayerProvider unmounts. Never directly exposed to users.
_Avoid_: Lifecycle, container, context

**Shadowing**:
The mechanism by which a Layer or Module in a `provide` array overrides a transitive dependency introduced by a Module's `imports`. No separate override API exists — shadowing is implicit when the same Tag is satisfied by multiple entries. It is per Tag: a local entry can shadow one output of a multi-Tag declared Layer, and the Analyzer reports `AmbiguousProvider` only when two providers have equal precedence. At run time the later entry in Position Order wins.
_Avoid_: Overriding, mocking, replacing, substituting

**Island**:
A server-rendered React component that downloads its chunk and hydrates as its own React root only when its trigger fires (`load`, `idle`, `visible`, `interaction`). Named in a `defineIslands` registry and rendered as `<Island name props />`. Islands of one registry share one app scope outside React (per page on the client, per process on the server) and each has its own component scope (ADR 0010).
_Avoid_: Widget, partial, lazy component

**Atom**:
A lazy, reactive value defined once at module level: plain writable state, a function of other atoms (read through `get`), an Effect, or a Stream. It holds no state itself; its state lives in an AtomStore. Kit atoms (`atom(value)`, `atom(fn, deps)`) resolve `deps` like a Kit Layer. Modeled on effect-atom (ADR 0008).
_Avoid_: Signal, observable, store

**AtomStore**:
The container of atom state and subscriptions owned by each LayerProvider and bound to its Scope: it resolves an atom's services through that scope and is disposed with it. It is effect-atom's Registry under a name that avoids "registry".
_Avoid_: Registry, atom registry, atom context

**Result**:
The state of an Effect or Stream atom: `Initial`, `Success` or `Failure` (holding a Cause), each with a `waiting` flag while it reloads. Kit hooks never expose it: they suspend on `Initial` and throw a SleekStackError on `Failure`.
_Avoid_: AsyncData, RemoteData, status

**Serializable Atom**:
An Atom opted in to SSR with a stable key, a `Schema` and an explicit kind: `Atom.serializable` (the schema describes the value) or `Atom.serializable.result` (the value is a Result; the schema describes its `Success` value). Only Serializable Atoms enter a Snapshot. Keys are unique per AtomStore (ADR 0016).
_Avoid_: Persisted atom, hydratable atom

**Snapshot**:
The `Record<key, encoded value>` of the settled Serializable Atoms built in an AtomStore (`dehydrate`), sent from the server and used to seed a client AtomStore before the first read (`hydrate`). Result atoms enter it only on `Success`. It is JSON-safe only when each schema encodes to JSON values (a `bigint` encoding breaks the transport). Distinct from the query layer's `Dehydrated`.
_Avoid_: Payload, atom state

### UI framework concepts (`@sleekstack/ui`, MVP)

**Component** *(ui)*:
A function `(props: P) => Effect<Node, E, R>`: `R` is the Tags it needs, `E` its tagged errors, `Node` a small renderable tree (text, element, fragment, guest). Unrelated to the `component` Lifetime.
_Avoid_: Effect component, view, widget

**Host**:
The Effect program that renders a tree of Components. Components run only in the Host; a Component is never rendered inside a React component (ADR 0015).
_Avoid_: Shell, root component

**Guest**:
A plain React component wrapped by `fromReact`, a `Component<P, never, never>` leaf. React renders it with its own `react-dom`; it receives no Effect context and its subtree is opaque. A Component under a Guest is an `EffectInsideReact` error.
_Avoid_: Island, embedded React

**Mount**:
`mount(app, { layer, container, onError? })` (DOM) or `renderToString(app, { layer })` (string): runs a tree with a fully satisfied Layer. A failure in `E` rejects with the original error. Each `mount` call is one Analyzer tree; a later `mount` on the same container wins.
_Avoid_: Render root, hydrate

**Provide**:
`Provide(layer, children)`: provides a Layer to a subtree, removing its Tags from the subtree's `R`.
_Avoid_: Context provider, LayerProvider

**Catch**:
`Catch(tag, fallback, children)`: renders `fallback` for one tagged error and removes only that tag from `E`.
_Avoid_: Error boundary, try

### Next.js integration concepts

**Request Scope**:
A server-side Scope created per `runEffect` call (`@sleekstack/runtime`, re-exported by `@sleekstack/next`) or per kit `defineEffect`/`defineQuery` call. Isolates services (auth, tracing, transactions) so no state leaks between requests.
_Avoid_: Request context, request environment, request runtime

**Action**:
A server-side operation (Next.js Server Action) declared with `defineEffect()` / `effect()` from `@sleekstack/kit/next`. Runs a generator in a Request Scope on the `@sleekstack/runtime` runtime, through the `@sleekstack/next` preset.
_Avoid_: Mutation, procedure, RPC

**Runtime Package**:
`@sleekstack/runtime`, the framework-agnostic Effect app runtime: `configureRuntime`, `runEffect`, `getRuntime`, the `onError` sink and a pluggable `isControlFlow` classifier (default: nothing is control flow). `@sleekstack/next` is its Next preset, adding `isNextControlFlow` and the devtools route handler (ADR 0013). `@sleekstack/runtime/internal` is for sibling packages only.
_Avoid_: Next runtime, server runtime

**Query** *(server-side)*:
A server-side read operation declared with `defineQuery()` / `query()` from `@sleekstack/kit/next`. Runs a generator in a Request Scope and caches nothing. Distinct from a Cached Query.
_Avoid_: Fetch, loader, resolver

**Devtools**:
The dev-only introspection of a running app: a bounded event buffer in `@sleekstack/runtime` (per-service acquire/release, fiber id, owning scope) served by the route handler in `@sleekstack/next/devtools`, rendered by the `@sleekstack/devtools` panel (graph roots, live scopes, services, atoms of every open AtomStore, errors linked to their scope). In production recording is off and the handler returns 404; the panel is excluded from production client chunks when mounted behind a dynamic import.
_Avoid_: Inspector, debug panel

### Query cache concepts

**Cached Query**:
A keyed, cached async read from `@sleekstack/query` (ADR 0014). `Query.make({ key, fetch, staleTime, gcTime, retry })` returns a family `(args) => query atom`; equal canonical keys share one entry in the query store. Its `fetch` is an Effect or Stream whose Tags resolve from that store's scope. The kit form is `cachedQuery()` from `@sleekstack/kit`, read with `useQuery` from `@sleekstack/kit/react`. Not the server-side Query of `@sleekstack/kit/next`.
_Avoid_: Query client, resource, loader

**Query Store**:
The AtomStore that holds Cached Queries for a subtree: the root LayerProvider's, or the nearest one marked with `QueryProvider`. Nested providers share it.
_Avoid_: Query client, QueryClientProvider

**QueryCache**:
The optional Tag holding a store's query registry: one entry per query definition and canonical key, with `key`, `updatedAt` and observers. Provide it to share or inspect a registry; otherwise each store gets its own. The `Queries` service (`invalidate`, `refetch`, `setData`, `getData`, `cancel`, `reset`; kit: `useQueryClient`) works on that registry.
_Avoid_: Query registry, cache client

**Mutation**:
A write from `Mutation.make({ run, onMutate, ... })` (`@sleekstack/query`) or `mutation()` (`@sleekstack/kit`), run with `useMutation`. Its state is `idle`, `pending`, `success` or `failure`, per hook unless `Mutation.shared`. `onMutate` can return a rollback, run on failure or interruption. Distinct from an Action, the server operation a mutation often calls.
_Avoid_: Command, action (for the client write)

**Dehydrated**:
The serializable query state (`[{ key, result, updatedAt }]`) that `prefetch` (`@sleekstack/next`) returns on the server and `<HydrateQueries state>` (`@sleekstack/react`) seeds into the Query Store. Built with `Hydrate` from `@sleekstack/query`; only `Hydrate.hydratable` queries can be in it.
_Avoid_: Snapshot, serialized cache
