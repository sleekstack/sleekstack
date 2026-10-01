# `@sleekstack/next` manages the Effect runtime; action/query sugar lives in kit

`@sleekstack/next` no longer exports `action`, `query`, `Operation` or `OperationOptions`. It provides `configureRuntime({ layer, onError })`, `runEffect(effect, { request, overrides })`, `getRuntime()` and a dev-only introspection buffer (`@sleekstack/next/devtools`). `@sleekstack/kit/next`'s `defineEffect`/`effect`/`defineQuery`/`query` are implemented on `runEffect`. Supersedes ADR 0009: the internal Exit hook is gone, because kit sees the call's `Exit` through `runEffect`. Kit owns the module system: its `configureRuntime({ provide })` builds a core app scope as the runtime's `layer`, and each call passes the request scope as a `request` Layer, so `@sleekstack/next` only ever sees plain Layers.

## Considered options

- **Keep sugar in next and mirror it in kit**: rejected. Only kit consumed it, and SleekStack does not encapsulate Effect for Effect users; they want runtime management, the graph and devtools.
- **Keep core's AppScope as the only runtime**: rejected for plain-Effect apps; `configureRuntime` takes a plain Layer. Kit lowers its `{ provide }` modules to such a Layer itself.
- **Ship devtools inside `@sleekstack/react`**: rejected. It would land in client bundles; a separate package mounted behind a `NODE_ENV` dead branch keeps that checkable by a bundle test.

## Consequences

- Breaking for direct users of next's `action`/`query` (pre-1.0); migration is prose in the docs, no codemod.
- Runtime contract: `onError(cause, { phase })` is the one sink for call defects, finalizer failures and failed builds; a throwing sink is swallowed; redirect/notFound and interruption are unreported; a failed build is retried; reconfigure interrupts in-flight calls, waits for the old runtime to dispose, then builds the new one. A config's optional `id` makes duplicate module copies (RSC and action bundles) agree on one runtime; `{ replace: true }` forces replacement on a dev hot reload. Kit rethrows Next control flow from handler bodies untouched.
- The static analyzer reads plain `Layer.*` graphs from `configureRuntime({ layer })` roots.
