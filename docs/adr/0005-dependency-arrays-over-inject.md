# Dependency arrays over inject() and params

`@sleekstack/kit` declares a Layer's dependencies as a trailing array of Tags — `layer(TaskRepo, (store, clock) => ..., [Store, Clock])` — and the same array for `defineEffect()`/`defineQuery()`, whose generator `yield*`s those Tags. The array is runtime metadata (it lowers to core `service()`'s `requires`, so ADR 0004's no-drift property holds), and TypeScript infers the factory's parameter types from it positionally.

## Considered options

- **Proxy-based resolution** (`({ store, clock }) => ...` backed by a Proxy that records reads): rejected — dependencies are only discovered by running the factory, so the graph can't be validated (missing/cycle/captive) before construction, and conditional reads make the edge set unstable.
- **An `inject()` call inside the factory** (Angular-style): rejected — needs an ambient injection context (hidden global), breaks for async factories after the first `await`, and again hides the edges from the graph until run time.
- **Parameter-type reflection via a compiler plugin**: rejected — requires a build plugin plus decorator/emit metadata in every toolchain (Next's SWC, Vite, tsc), which the project rules out; types are erased at run time anyway.
- **An explicit dependency array** *(chosen)*: one visible list, validated by `buildGraph` before anything is constructed, no plugin, works identically for sync and async factories and classes. The cost is naming each Tag twice (array + parameter), which positional inference keeps type-checked.
