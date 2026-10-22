# @sleekstack/analyze

The static dependency-graph analyzer behind [`sleekstack check`](../cli). It reads a tsconfig project's core modules, plain Layers and runtime roots through the TypeScript checker and returns the graph and every violation with file:line. It never imports or runs app code (ADR 0010, ADR 0011).

```ts
import { analyze } from '@sleekstack/analyze'

const report = analyze({ project: 'tsconfig.json', entries: ['src/runtime.ts'], lenient: false })
```

- `project`: path to a `tsconfig.json`.
- `entries`: limit the roots to the `configureRuntime` / `runEffect` calls in these files (otherwise every call outside test files).
- `lenient`: turn an unresolvable `runEffect` Layer into an opaque root instead of an error.

Roots are `configureRuntime` layers plus `runEffect` `request` and `overrides` Layers; each is checked as its own graph. A `Report` lists the roots' nodes, modules and `AnalyzeError`s (`code`, `message`, `file`, `line`).

## What it checks

`MissingDependency`, `DependencyCycle`, `CaptiveDependency` (lifetime matrix), `PrivateDependency` (module `exports`), `AmbiguousProvider`, `ModuleCycle` and `DuplicateModule`. For `declareLayer` and plain Layers, provided and required Tags are read from the Layer type (`ROut`, `RIn`).

It fails closed: a declaration it cannot read (`any`, a widened array, a non-literal key) is an error, with no opt-out. `typescript` is a peer dependency.

## Component pass (`@sleekstack/ui`)

```ts
import { analyzeComponents } from '@sleekstack/analyze'

const { trees, errors } = analyzeComponents({ project: 'tsconfig.json' })
```

It builds one tree per `mount` call (nodes `component`, `provide`, `catch`, `unresolved`) and walks it once, carrying provided Tags and caught errors downward. Every branch counts as rendered. A `lazy(() => import('./x'))` component is read through the module's default export, plus its `LazyLoadError`. It reports, with file:line:

- `MissingDependency`: a Component needs a Tag no `Provide` or mount layer supplies. `@sleekstack/ui`'s `Store` (used by the atom hooks) is always provided at `mount`; another Tag that prints as `Store` is shown as `<file>#Store` and is not.
- `UnhandledError`: a tagged error reaches `mount` without a `Catch`, or a host event closure (`onXxx`) has a non-`never` `E` (even under a matching `Boundary`). Closures are component nodes with `closure: true`; their `R` is checked like any component's and an unreadable closure type is `Unresolved`.
- `EffectInsideReact`: a Component sits under a `fromReact` guest (in its JSX or passed through its props).
- `Unresolved`: a component or Layer it cannot read (`any`, a dynamically picked component, an unread declaration). It fails closed.
- `ConditionalSlot`: a `useLocal` call that is not a top-level statement of the component's `Effect.gen` body before any return.
- `MissingKey`: a `.map` / `.flatMap` / `Array.from` callback in child position returning unkeyed JSX or a fragment.
- `NonResumableHandler`: an `on()` handler that is not a reference to a top-level `const h = defineHandler('literal', ...)`, or a `resume` handler map it cannot read. Each `resume` call is a tree root whose handlers are checked against its layer.

`sleekstack check` runs it only when the nearest package.json lists `@sleekstack/ui` (any dependency field) and adds a `components` key to `--json`; other projects are unchanged. [`apps/showcase`](../../apps/showcase/README.md) has one fixture per code in `apps/showcase/fixtures/`.

## Controller pass

```ts
import { analyzeControllers, controllerRoute } from '@sleekstack/analyze'

const { controllers, errors } = analyzeControllers({ project: 'tsconfig.json' }) // serverDir, controllersDir optional
```

It reads every `*.controller.ts` file (ADR 0053). `controllerRoute(controllersDir, file)` gives its route name and URL pattern in ADR 0050's syntax (`users/[id]` is `/users/:id`); the Vite plugin uses the same derivation. Each method (`GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`) goes through the signature reader the Server Service pass uses, and its `schema.input` marks the `number` and `boolean` values of `params` and `query` with `codec: 'string'`. A method may leave out its return type; then `schema.success` is undefined. It reports, with file:line:

- `ControllerMethodShape`: a near-miss export (`get`, `Post`, a default export), a method that is not one function of one `{ params?, query?, body? }` object returning an Effect, a `body` on `GET`, `HEAD` or `OPTIONS`, or a `params` or `query` value that does not decode from a string.
- `ControllerParamsMismatch`: the keys of `params` differ from the path's params.
- `ServerServiceTypeNotSerializable`: an input or written success type outside the Server Service type subset.
- `MissingDependency`: a service a method requires that no request service, `start({ layer })` or `wrap` above it provides. A `wrap` (in a `_defaults.ts` from the server directory down, or the Controller's own) discharges its `next` requirements minus its result's.
- `Unresolvable`: a `*.controller.ts` file whose path is not a route.

`sleekstack check` runs it on every project and counts each Controller as a root, so a server-only app has roots.
