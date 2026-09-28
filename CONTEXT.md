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
The validated dependency structure produced by `buildGraph(entries)`: construction order, module privacy, lifetime checks, and shadowing resolved across every entry and imported Module. `snapshot(graph)` exposes it as a serializable `GraphSnapshot` DTO (one node per provided Tag, keyed by the Tag key, or `Tag@Module` when shadowed; edges; lifetimes; owning module; per-Tag private flag) for tooling such as devtools.
_Avoid_: Dependency tree, container, registry

**Captive Dependency**:
A lifetime-safety violation where a longer-lived entry would depend on a shorter-lived one (e.g. `app` on `request`), which would otherwise capture a stale or already-finalized instance. Rejected by `buildGraph` per the lifetime matrix, naming both services and their lifetimes.
_Avoid_: Lifetime leak, scope violation

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

### Next.js integration concepts

**Request Scope**:
A server-side Scope created per incoming Next.js request by `@sleekstack/next`. Isolates services (auth, tracing, transactions) so no state leaks between requests.
_Avoid_: Request context, request environment, request runtime

**Action**:
A server-side operation (Next.js Server Action) wrapped by `action()` from `@sleekstack/next`. Runs an Effect generator in a Request Scope with access to the global runtime layer.
_Avoid_: Mutation, procedure, RPC

**Query** *(server-side)*:
A server-side read operation wrapped by `query()` from `@sleekstack/next`. Runs an Effect generator in a Request Scope. Distinct from any future client-side query/cache primitives.
_Avoid_: Fetch, loader, resolver
