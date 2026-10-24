# @sleekstack/analyze

The static dependency-graph analyzer behind [`sleekstack check`](../cli). It reads a tsconfig project's core modules, plain Layers and runtime roots through the TypeScript checker and returns the graph and every violation with file:line. It never imports or runs app code (ADR 0010, ADR 0011).

```ts
import { analyze } from '@sleekstack/analyze'

const report = analyze({ project: 'tsconfig.json', entries: ['src/runtime.ts'], lenient: false })
```

- `project`: path to a `tsconfig.json`.
- `entries`: limit the roots to the `configureRuntime` / `runEffect` calls in these files (otherwise every call outside test files: `TEST_FILE` matches a file under `__tests__/`, `test/` or `tests/`, or named `*.test.*` or `*.spec.*`).
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

- `ControllerMethodShape`: a near-miss export (`get`, `Post`, a default export), a method that is not one function of one `{ params?, query?, body? }` object returning an Effect (written inline: a type alias of the whole `Effect.Effect<...>` is not read, an alias of its success type is), a `body` on `GET`, `HEAD` or `OPTIONS`, or a `params` or `query` value that does not decode from a string.
- `ControllerParamsMismatch`: the keys of `params` differ from the path's params.
- `ServerServiceTypeNotSerializable`: an input or written success type outside the Server Service type subset.
- `MissingDependency`: a service a method requires that no request service, Layer File, `start({ layer })` or `wrap` above it provides. A `wrap` (in a `_defaults.ts` from the server directory down, or the Controller's own) discharges its `next` requirements minus its result's; what its result requires must come from a request service, a Layer File, `start({ layer })` or a `wrap` above it, else it is reported once at that `wrap`.
- `Unresolvable`: a `*.controller.ts` file whose path is not a route.

`sleekstack check` runs it on every project and counts each Controller as a root, so a server-only app has roots. It always reads the default `server` and `server/routes`: the Vite plugin's `serverDir` and `controllersDir` options do not reach it, and it has no flag for them.

## Layer File pass

```ts
import { analyzeLayerFiles } from '@sleekstack/analyze'

const { layerFiles, serverRoot, errors } = analyzeLayerFiles({ project: 'tsconfig.json' }) // serverDir optional
```

It reads every `*.layer.ts` file of the program but tests (ADR 0054). Each default export is a Layer, read from its type: `ROut` is what it provides, `RIn` what it requires. `layerFiles` lists them in composition order (each after the files that provide what it requires, otherwise by path). `serverRoot` is the server directory's `_app.ts` and whether it exports `onError`. It reports `ServerFileShape` (a default export that is not a Layer or is typed `any`, an `_app.ts` export other than `onError`), `LayerFileConflict` (two files provide one Tag), `LayerFileCycle`, and `MissingDependency` (a Tag no Layer File provides).

## RPC pass

```ts
import { analyzeRpc } from '@sleekstack/analyze'

const { services, errors } = analyzeRpc({ project: 'tsconfig.json' }) // serverDir, controllersDir optional
```

Each `*.rpc.ts` file under the server directory is one Server Service: its Tag name comes from the basename (`comments-api.rpc.ts` is `CommentsApi`) or a `service` string export, and its methods are its exported functions. Each key of the RPC Manifest (the server directory's `rpc.ts`, `export default rpc({ NoteLookup: { find: 'GET notes/[id]' } })`) is one more Server Service whose methods wrap Controller Methods. Methods go through the Server Service signature reader. It reports `RpcMethodShape`, `RpcRouteUnknown` (a Manifest entry that names no Controller method), `RpcNameCollision` (a Tag name shared with another RPC service, a `ServerService` id, a Layer File output or a `serverFn` id), `ServerFileShape`, `ServerServiceTypeNotSerializable` and `ServerFileInClientGraph`.

`sleekstack check` runs both passes on every project. It counts a Tag declared by `virtual:sleek/rpc` as provided for `start({ services })`, because the discovered app supplies its implementation. A hand-written Server Service with no implementation Layer is still `MissingDependency`.
