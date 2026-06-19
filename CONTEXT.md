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
The resolved runtime value obtained by providing a Tag to `useService()`. Distinct from the Tag (the identifier) and the Layer (the constructor).
_Avoid_: Instance, dependency, singleton

**Module**:
A named group of Layers with explicit dependency declarations (`imports`) and a declared public surface (`exports`). The primary architectural unit in SleekStack. Created with `module()`.
_Avoid_: Package, bundle, plugin, feature

### React integration concepts

**LayerProvider**:
A React component that creates a runtime scope and makes a set of Layers and Modules available to its subtree via the `provide` prop. Nested LayerProviders inherit from their parent scope.
_Avoid_: ServiceProvider, ScopeProvider, ContextProvider

**Scope**:
An Effect `Scope` managed internally by a LayerProvider. Finalizes all acquired resources when the LayerProvider unmounts. Never directly exposed to users.
_Avoid_: Lifecycle, container, context

**Shadowing**:
The mechanism by which a Layer or Module in a `provide` array overrides a transitive dependency introduced by a Module's `imports`. No separate override API exists — shadowing is implicit when the same Tag is satisfied by multiple entries.
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
