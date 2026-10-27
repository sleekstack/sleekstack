# SleekStack — agent guide

Effect-native dependency injection and UI for TypeScript apps. Tags and Layers come from `effect` directly; SleekStack does not wrap them. Validate every change with `npx sleekstack check` (exit 0 clean, 1 violations, 2 usage error); `npx sleekstack explain <CODE>` prints a code's rule and fixes.

## Packages

- `@sleekstack/core`: `module`, `declareLayer`, `Atom`, `Result`, the graph errors.
- `@sleekstack/runtime`: `configureRuntime({ layer })` once per app, `runEffect(effect, { request?, overrides? })` per call.
- `@sleekstack/ui`: Effect components (`function*` bodies that `yield*` Tags), `mount`, `Provide`, `Catch`, `Pending`, `renderToString`, `renderToStream`, hooks (`useLocal`, `useAtom`, `useAction`, ...), handlers (`on`, `defineHandler`).
- `@sleekstack/router`: `routes`, `router`, `Link`, `loader`, `action`, `handle` (server), `startRouter` (client).

## Patterns

```ts
import { Context, Effect, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'

class Db extends Context.Tag('Db')<Db, { query(sql: string): unknown }>() {}
class Repo extends Context.Tag('Repo')<Repo, { list(): unknown }>() {}

const DbLive = declareLayer(Layer.succeed(Db, { query: (sql) => sql }), { lifetime: 'app' })
const RepoLive = declareLayer(
  Layer.effect(Repo, Effect.map(Db, (db) => ({ list: () => db.query('select *') }))),
  { lifetime: 'request' },
)

export const Data = module({ name: 'Data', entries: [DbLive, RepoLive], exports: [Repo] }) // Db is private
```

A ui component is a generator; `yield*` a Tag to depend on it, and `mount` (or `Provide`) supplies the Layer:

```tsx
/** @jsxImportSource @sleekstack/ui */
import { mount } from '@sleekstack/ui'

const List = function* () {
  const repo = yield* Repo
  return <pre>{String(repo.list())}</pre>
}
mount(<List />, { layer: AppLive, container: document.body })
```

Keep Tags (ports) apart from Layers (implementations): client code imports Tags, and only the composition root imports the Layers.

## Lifetime matrix

| Entry lifetime | May depend on |
| --- | --- |
| `app` | `app` |
| `request` | `app`, `request` |
| `component` | `app`, `component` |

Anything else is a `CaptiveDependency`. `request` and `component` never nest.

## Vocabulary

- **Tag**: an Effect `Context.Tag`. **Layer**: an Effect `Layer` that builds services. **Declared Layer**: a Layer plus its Lifetime (`declareLayer`). **Module**: a named group of entries with `imports` and `exports`; unexported Tags are private to the module.
- **Lifetime**: `app` | `request` | `component`. **Shadowing**: a more local provider of a Tag overrides an outer one.
- **Service Class** / **Class Controller** (`@sleekstack/start`): `class X extends Service<X>()(id, { db: Db })` / `export default class extends Controller({ db: Db })`, generator methods returning `Gen<A, E, R>`, each declared Tag on `this`.
- **Served Record**: `export default records(R)` (`@sleekstack/start`) in a `[id].controller.ts` serves `GET`/`PATCH` via R's adapter Tag (a `*.layer.ts` on the server, generated in the browser). `readOnly(schema)` drops a field from `R.change`; failures `RecordNotFound` 404, `RecordRejected` 422.
- Avoid: "provider", "container", "registry", "injector", "token"; say Layer, Graph, Module, Tag.

## Errors

<!-- generated:errors:start -->
- `MissingDependency`: Every Tag a service or component requires is provided by an entry in scope.
- `DependencyCycle`: Services may not require each other in a cycle.
- `AmbiguousProvider`: At most one provider of a Tag sits at each locality, so Shadowing can pick one.
- `ModuleCycle`: Modules may not import each other in a cycle.
- `DuplicateModule`: Each module name belongs to one module.
- `CaptiveDependency`: A service may only depend on services that live at least as long (app may not capture request or component).
- `PrivateDependency`: Only Tags a module exports are visible outside it.
- `EmittedSibling`: Emitted .js/.d.ts output does not sit next to its .ts source.
- `Unresolvable`: Every declaration in the graph is statically readable; the analyzer fails closed.
- `Computed`: Provide lists, imports and names are statically evaluable (literals, local consts, loops over literal lists).
- `NonLiteralOptions`: runEffect options are statically readable.
- `Unresolved`: Every component and Layer in a mount tree is statically readable (no any, no dynamically picked component).
- `UnhandledError`: Every tagged error a component can fail with is caught before mount.
- `EffectInsideReact`: Effect components are not rendered under a fromReact guest.
- `NonResumableHandler`: Every on() entry names a top-level const defineHandler("literal-id", ...), and resume loaders import a module whose default export is one.
- `ConditionalSlot`: useLocal is called at the top level of a component's generator body (`function*` or `Effect.gen`): not inside a condition, loop, nested or helper function, or after an early return.
- `MissingKey`: Every element or component a .map / .flatMap / Array.from callback renders as children carries a key prop.
- `ServerServiceFileShape`: A ServerService file holds only imports, types, Data.TaggedError, Schema.TaggedError and ServerService classes, is not and imports no *.server.ts, and each Tag id has one class.
- `ServerServiceMethodShape`: Every ServerService method is written out as `(input?) => Effect.Effect<A, E>`: one parameter at most, R = never, no `any`; a `Schema.Schema.Type<typeof X>` names an exported Schema of a client-safe module where the reader can follow it.
- `ServerServiceTypeNotSerializable`: ServerService and Controller method types are JSON-shaped: primitives, literals, unions, arrays, plain objects, string-keyed records; Server Service errors are Data.TaggedError or Schema.TaggedError classes.
- `ServerFileInClientGraph`: No server-only file (*.server.ts, *.controller.ts, *.rpc.ts, *.layer.ts, or a _defaults.ts, rpc.ts or _app.ts under the server directory) is value-imported, directly or not, by a module importing virtual:sleek/server or virtual:sleek/rpc, nor holds a Schema or error class a generated client imports.
- `ControllerMethodShape`: A Controller method is a named export GET, HEAD, POST, PUT, PATCH, DELETE or OPTIONS: a function of one object `{ params?, query?, body? }` (body only on POST, PUT, PATCH, DELETE) returning an Effect, no `any`; params and query decode from strings. Or the default export is one class extending `Controller(...)` directly, its HTTP-named members generator methods with a written `Gen`, beside no named method.
- `ControllerParamsMismatch`: The keys of a Controller method's params equal its path's params (`[id]` is `params.id`).
- `RecordsRouteShape`: A Controller default-exporting `records(Record)` sits at a path ending in exactly `[id]`, calls `records` of @sleekstack/start, and passes a const `defineRecord(...)` with an `adapter` whose fields' Schemas need no Service.
- `RecordsMethodCollision`: A Controller default-exporting `records(...)` exports no named GET or PATCH, which it serves.
- `LayerFileCycle`: Layer Files may not require each other in a cycle.
- `LayerFileConflict`: Each Tag is provided by one Layer File at most.
- `ServerFileShape`: A *.layer.ts file's default export is a Layer, not typed `any`; the server directory's _app.ts exports only onError; an RPC File's service name is [A-Za-z][A-Za-z0-9]* and a `service` export a string literal; rpc.ts default-exports an object literal of 'VERB route' string literals.
- `RpcMethodShape`: An RPC method is an exported function declaration, or an arrow or function expression on an exported const, written `(input?: T) => Effect.Effect<A, E, R>`: one typed parameter at most, no generics, async, Effect.fn or `any`, not a Response, R naming no generated Tag; a wrapped Controller Method is written out the same way.
- `RpcRouteUnknown`: Each RPC Manifest entry 'VERB route' names a Controller route and a method that Controller exports.
- `RpcNameCollision`: RPC File and RPC Manifest Tag names, ServerService ids, Layer File output Tag keys and serverFn ids are unique.
<!-- generated:errors:end -->
