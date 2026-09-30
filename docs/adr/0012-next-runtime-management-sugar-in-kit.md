# `@sleekstack/next` manages the Effect runtime; action/query sugar lives in kit

`@sleekstack/next` no longer exports `action`, `query`, `Operation` or `OperationOptions`. It provides `configureRuntime({ layer, onError })`, `runEffect(effect, { request, overrides })`, `getRuntime()` and a dev-only introspection buffer (`@sleekstack/next/devtools`). `@sleekstack/kit`'s `action`/`query`/`defineEffect`/`defineQuery`/`effect` are implemented on `runEffect`. Supersedes ADR 0009: the internal Exit hook is gone, because kit sees the call's `Exit` through `runEffect` and its `provide` option directly.

## Considered options

- **Keep sugar in next and mirror it in kit**: rejected. Only kit consumed it, and SleekStack does not encapsulate Effect for Effect users; they want runtime management, the graph and devtools.
- **Keep core's AppScope as the only runtime**: rejected for plain-Effect apps; `configureRuntime` accepts a plain Layer (kit still passes `{ provide }` modules, which map onto the same entry point).
- **Ship devtools inside `@sleekstack/react`**: rejected. It would land in client bundles; a separate package mounted behind a `NODE_ENV` dead branch keeps that checkable by a bundle test.

## Consequences

- Breaking for direct users of next's `action`/`query` (pre-1.0); migration is prose in the docs, no codemod.
- Runtime contract: `onError` gets defects once and finalizer failures (unless `onFinalizerError`); a throwing sink is swallowed; redirect/notFound and interruption are unreported; a failed build is retried; reconfigure interrupts in-flight calls before disposing.
- The static analyzer reads plain `Layer.*` graphs from `configureRuntime({ layer })` roots.
