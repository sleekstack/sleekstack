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
- `ServerFileInClientGraph`: No server-only file (*.server.ts, *.controller.ts, or a _defaults.ts under the server directory) is value-imported, directly or not, by a module importing virtual:sleek/server.
- `ControllerMethodShape`: A Controller method is a named export GET, HEAD, POST, PUT, PATCH, DELETE or OPTIONS: a function of one object `{ params?, query?, body? }` (body only on POST, PUT, PATCH, DELETE) returning an Effect, no `any`; params and query decode from strings.
- `ControllerParamsMismatch`: The keys of a Controller method's params equal its path's params (`[id]` is `params.id`).
<!-- generated:errors:end -->
