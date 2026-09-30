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
The resolved runtime value obtained by providing a Tag to `useService()`. Distinct from the Tag (the identifier), the Layer (the constructor), and the Service Definition (the helper that carries the constructor's dependency metadata).
_Avoid_: Instance, dependency, singleton

**Service Definition**:
The output of `service(tag, { requires, lifetime }, make)` — an Effect Layer plus runtime metadata (provided Tag, required Tags, lifetime) that drives auto-wiring, readable dependency errors, and lifetime checks. A raw Layer carries none of this metadata; a Service Definition wraps it so the metadata and the Layer's requirement type cannot drift apart.
_Avoid_: Definition, ServiceFactory, provider definition

**Lifetime**:
One of `app`, `request`, or `component` — how long a constructed service lives before it is finalized. Constrains which lifetimes may depend on which (the lifetime matrix: `app` on `app`; `request` on `app`+`request`; `component` on `app`+`component`; `request` and `component` never nest).
_Avoid_: Scope kind, duration, lifecycle tier

**Module**:
A named group of entries — Service Definitions, declared Layers, or bare Layers — with imports (other Modules, pulled in transitively) and exports. Exports are enforced: when `exports` is given, every other Tag the Module provides is private and may be required only by the Module's own entries — importers, root entries, `useService`, action/query deps, per-call `provide` entries and child scopes get `PrivateDependency`. Omitted `exports` means all public. Shadowing a private Tag from outside provides a new public one (ADR 0006). The primary architectural unit in SleekStack. Created with `module()`.
_Avoid_: Package, bundle, plugin, feature

**Graph**:
The dependency structure of every entry and imported Module under a root (`configureRuntime` call): nodes, edges, lifetimes, module privacy and shadowing. Validated only by the Analyzer, at build time (ADR 0011); `sleekstack check --json` reports it (one node per provided Tag, keyed by the Tag key, or `Tag@Module` when shadowed). The runtime keeps no validated Graph, only a Resolution Plan.
_Avoid_: Dependency tree, container, registry

**Captive Dependency**:
A lifetime-safety violation where a longer-lived entry would depend on a shorter-lived one (e.g. `app` on `request`), which would otherwise capture a stale or already-finalized instance. Reported by the Analyzer per the lifetime matrix, naming both services and their lifetimes.
_Avoid_: Lifetime leak, scope violation

### Kit facade concepts

**Kit**:
`@sleekstack/kit`, the Effect-free facade over core, next and react. It lowers every call to the core API; no Effect type is reachable from its public entries.
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
`@sleekstack/analyze`, run as `sleekstack check [--project <tsconfig>] [--entry <file>...] [--json]`. Reads the declarations through the TypeScript checker without executing app code, builds each root's Graph and reports every violation with file:line (exit 0 ok, 1 violations, 2 crash or no roots). Fails closed: a declaration it cannot read is an error. `--entry` limits the roots to the given files.
_Avoid_: Linter, compiler plugin

**Resolution Plan**:
Core's internal, non-exported construction order and shadowing for a scope (`buildPlan(entries)`). The root plan does not validate; per-call `provide` and child-scope boundaries still check ambiguity and cycles.
_Avoid_: Graph, snapshot

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
The mechanism by which a Layer or Module in a `provide` array overrides a transitive dependency introduced by a Module's `imports`. No separate override API exists — shadowing is implicit when the same Tag is satisfied by multiple entries. It is per Tag: a local entry can shadow one output of a multi-Tag declared Layer, and `AmbiguousProvider` fires only when two providers have equal precedence.
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

### Next.js integration concepts

**Request Scope**:
A server-side Scope created per `runEffect` call (`@sleekstack/next`) or per kit `defineEffect`/`defineQuery` call. Isolates services (auth, tracing, transactions) so no state leaks between requests.
_Avoid_: Request context, request environment, request runtime

**Action**:
A server-side operation (Next.js Server Action) declared with `defineEffect()` / `effect()` from `@sleekstack/kit/next`. Runs a generator in a Request Scope on the `@sleekstack/next` runtime.
_Avoid_: Mutation, procedure, RPC

**Query** *(server-side)*:
A server-side read operation declared with `defineQuery()` / `query()` from `@sleekstack/kit/next`. Runs a generator in a Request Scope. Distinct from any future client-side query/cache primitives.
_Avoid_: Fetch, loader, resolver

**Devtools**:
The dev-only introspection of a running app: a bounded event buffer and route handler in `@sleekstack/next/devtools`, rendered by the `@sleekstack/devtools` panel (graph, live scopes, atoms, errors). Absent from production builds.
_Avoid_: Inspector, debug panel
