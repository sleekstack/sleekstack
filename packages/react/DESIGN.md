Design notes for SleekStack React integration — Phase 1
=====================================================

This document captures the runtime and behavioral contracts for the `LayerProvider` / `useService`
integration used in Phase 1. It complements the public TypeScript declarations in `src/types.d.ts`.

Key guarantees
--------------

- Scoped ownership: each `LayerProvider` owns an isolated scope that contains all resources acquired
  by layers provided to that provider. Resources must be finalized when the provider unmounts.
- Lazy acquisition: Layers are only constructed when a consumer requests the associated service.
- Suspense integration: if a factory is asynchronous, `useService` uses React Suspense by throwing a
  Promise that resolves when the service is ready; errors propagate as thrown exceptions.
- Single-flight: concurrent requests for the same service within the same provider scope share a
  single construction invocation and receive the same resulting instance.

Provider lifecycle
------------------

1. Mount: the provider creates a fresh runtime/scope for the subtree. It composes the provided
   layers with any inherited layers from parent providers. No layer factories are invoked during mount.
2. Resolve: when a service is requested via `useService`, the provider (or runtime) will:
   - If the service is already available, return synchronously.
   - If a construction is in progress, share the in-flight Promise with the new requester.
   - Otherwise, start the factory and store a pending Promise; if the factory is async, the hook
     will throw the Promise for Suspense.
3. Unmount: the provider closes its scope and invokes all finalizers for resources that were acquired
   within the scope. Finalizers should be invoked in the inverse order of acquisition.

Overrides & precedence
----------------------

Precedence (highest to lowest):

1. Explicit `overrides` map on the provider props.
2. `layers` array passed to the provider props.
3. Parent provider layers.

Child providers always supersede parent-provided behavior for the same ServiceTag.

Dependency ordering & cycles
---------------------------

- When a layer factory depends on other services from the same provider, the runtime must ensure
  the dependent services are constructed and made available to the factory (either synchronously or
  via awaiting a Promise returned by `env.get`).
- Cycle detection: implementations SHOULD track an in-progress build stack and throw a clear error
  if a back-edge is detected (A -> B -> A). Conservative detection that surfaces cycles to the
  developer is preferred to deadlock or stack overflows.

Error handling
--------------

- Errors thrown during a factory must be propagated to the consumer. For `useService` this means the
  hook should throw the error so a React Error Boundary can catch it.
- Provider-level errors during setup should cause mount to fail with a descriptive error and ensure
  any partially acquired resources are finalized.

Testing contracts
-----------------

Implementations should include tests that assert the following:

- Suspense behavior: components using `useService` for async factories suspend until resolution.
- Single-flight: concurrent consumers share a single factory invocation.
- Cleanup: finalizers run on provider unmount and run in reverse acquisition order.
- Overrides: child provider overrides take effect and parent layers are shadowed.
- Missing dependency: requesting an unprovided tag yields a clear, descriptive error.

Next steps for Phase 2
----------------------

- Replace the Phase 1 runtime with `effect` `Scope` and `Runtime` primitives to get structured
  concurrency, interruption and deterministic cleanup.
- Wire provider scopes to Next.js request lifecycles for server-side request-scoped environments.
- Add devtools hooks to observe lifecycle events, acquisition/cleanup timings and errors.

