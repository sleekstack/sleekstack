# Middle-path Effect coupling: expose Tags and Layers, hide Runtime and Scope

Users write Effect-native `Context.Tag` and `Layer` directly — SleekStack does not wrap or alias them. SleekStack hides `Runtime`, `Scope`, and `Fiber` entirely, managing their lifecycle internally per `LayerProvider`. This means `@sleekstack/core` exports only `module()`; everything else comes from `effect`.

## Considered options

- **Full abstraction**: hide all Effect primitives behind SleekStack-owned wrappers (`createToken`, `createServiceProvider`, etc.). Rejected because it creates a maintenance surface, caps power users at SleekStack's API ceiling, and doubles the conceptual load for developers who already know Effect.
- **Full exposure**: re-export all Effect primitives and add thin helpers. Rejected because it blurs the line between what SleekStack adds and what Effect provides, and forces users to understand fibers, runtimes, and scope management to use the library.
- **Middle path** *(chosen)*: users write Effect's surface-level primitives (`Context.Tag`, `Layer`, `Effect.gen`) and SleekStack owns the infrastructure layer (`Runtime`, `Scope`, `Fiber`). Each side does what it's best at.
