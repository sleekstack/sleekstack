# The Effect runtime lives in `@sleekstack/runtime`; `@sleekstack/next` is its Next preset

`configureRuntime`, `runEffect`, `getRuntime`, `RuntimeNotConfigured`, `reportFinalizerFailure`, the error-sink and config types and the dev event buffer move from `@sleekstack/next` into the framework-agnostic `@sleekstack/runtime`. Supersedes the package-boundary part of ADR 0012; the runtime contract it describes (one sink, retried builds, reconfigure, `id`) is unchanged. `@sleekstack/next` re-exports the generic APIs and owns only Next-specific parts: `isNextControlFlow`, a `runEffect` that passes that classifier on every call (so an old slot that won the first-config race still rethrows Next control flow) and the `@sleekstack/next/devtools` route handler. Kit imports the runtime package and sets `isControlFlow: isNextControlFlow` in `kit/next`.

## Considered options

- **Keep the runtime in `@sleekstack/next`**: rejected. Nothing in it is Next-specific except the digest classifier, and the RR7 and TanStack Start adapters would otherwise depend on Next.
- **A Next-free subpath of `@sleekstack/next`**: rejected. The package would still carry a `next` peer dependency.

## Consequences

- `isControlFlow` is a `RuntimeConfig` field (default: nothing is control flow) stored with the first config for an `id`; outside the Next preset, control flow is classified only by the supplied function, never by Next digests. A classified value thrown while the app Layer builds is rethrown untouched.
- The `globalThis` slot key `'@sleekstack/next/runtime-slot/v3'` is frozen, and new slot fields are optional, so module copies on the old and new package layouts share one runtime.
- `@sleekstack/runtime/internal` holds what sibling packages need (the event buffer, `traceService`). It is not public API and is excluded from the docs entry points.
- Devtools events come from no Supervisor or Tracer, so a user's own Tracer is untouched. The runtime sets a FiberRef to the owning scope (`app` around the app build, `request#N` around each `runEffect` call); in dev, kit wraps each provided Tag in a hook that records one acquire/release with `Effect.fiberId`, under the Tag key (the analyzer's node id). A plain Layer given straight to the runtime yields one whole-layer `app` or `request` event. Nothing records in production.
- The analyzer treats each `runEffect({ request, overrides })` Layer as a root (`kind: 'request' | 'overrides'`), checked against its own provides plus any `configureRuntime` app root. `sleekstack check --lenient` turns an unresolvable `runEffect` Layer into an opaque root (`kind: 'opaque'`) instead of an error; an unresolvable app Layer or a missing Tag still fails.
- Atom stores are inspectable in dev: `LayerProvider` adds its `AtomStore` to a fixed `globalThis` list, which `@sleekstack/react/internal` only reads (`atomStores`, `useProviderAtomStore`), and core's `@internal` `AtomStore.inspect()` lists `{ atom, label, value }`. The devtools panel lists every open store; production bundles contain no registry code.
- `@sleekstack/devtools` stays a separate package.
