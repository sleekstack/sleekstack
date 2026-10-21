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
- `MissingDependency`: Every Tag a service or component requires is provided by an entry in scope. Fix: Provide the Tag in this module or one it imports; Wrap the component in a Provide (or the mount layer) that supplies it.
- `DependencyCycle`: Services may not require each other in a cycle. Fix: Break the cycle: move the shared part into a third service both depend on.
- `AmbiguousProvider`: At most one provider of a Tag sits at each locality, so Shadowing can pick one. Fix: Remove one of the providers; Move one provider into an imported module so the closer one shadows it.
- `ModuleCycle`: Modules may not import each other in a cycle. Fix: Extract the shared entries into a module both import.
- `DuplicateModule`: Each module name belongs to one module. Fix: Rename one of the modules; Import the existing module instead of declaring a second one.
- `CaptiveDependency`: A service may only depend on services that live at least as long (app may not capture request or component). Fix: Shorten the dependent service lifetime; Lengthen the dependency lifetime.
- `PrivateDependency`: Only Tags a module exports are visible outside it. Fix: Add the Tag to the module exports; Depend on an exported service instead.
- `EmittedSibling`: Emitted .js/.d.ts output does not sit next to its .ts source. Fix: Delete the emitted file; Set outDir (or noEmit) in tsconfig.
- `Unresolvable`: Every declaration in the graph is statically readable; the analyzer fails closed. Fix: Use a literal or a direct reference instead of a computed value; Annotate the value with its Layer type.
- `Computed`: Provide lists, imports and names are statically evaluable (literals, local consts, loops over literal lists). Fix: Replace the computed expression with a literal list or a local const.
- `NonLiteralOptions`: runEffect options are statically readable. Fix: Pass the options as an object literal at the call.
- `Unresolved`: Every component and Layer in a mount tree is statically readable (no any, no dynamically picked component). Fix: Type the component or Layer explicitly; Render the component directly instead of picking it at run time.
- `UnhandledError`: Every tagged error a component can fail with is caught before mount. Fix: Wrap the component in a Catch for the error tag; Handle the error inside the component.
- `EffectInsideReact`: Effect components are not rendered under a fromReact guest. Fix: Move the Effect component out of the React guest; Convert the guest subtree to Effect components.
- `NonResumableHandler`: Every on() entry names a top-level const defineHandler("literal-id", ...), and resume loaders import a module whose default export is one. Fix: Hoist the defineHandler call to a top-level const with a string-literal id; Pass that const to on() instead of an inline function or a reassigned variable.
- `ConditionalSlot`: useLocal is called at the top level of a component's generator body (`function*` or `Effect.gen`): not inside a condition, loop, nested or helper function, or after an early return. Fix: Move the useLocal call to the top of the component body, before any conditional return; Keep the local state in the component and pass it to the helper as an argument.
- `MissingKey`: Every element or component a .map / .flatMap / Array.from callback renders as children carries a key prop. Fix: Add a key prop unique among the siblings, such as the item's id; Wrap a returned fragment in an element that carries the key.
- `ServerServiceFileShape`: A ServerService file holds only imports, types, Data.TaggedError and ServerService classes, is not and imports no *.server.ts, and each Tag id has one class. Fix: Move values and implementation code into a *.server.ts file; Give each ServerService its own Tag id.
- `ServerServiceMethodShape`: Every ServerService method is written out as `(input?) => Effect.Effect<A, E>`: one parameter at most, R = never, no `any`. Fix: Pass several inputs as one object; Provide services in the implementation Layer; Replace `any` with the type.
<!-- generated:errors:end -->
