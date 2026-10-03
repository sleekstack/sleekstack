# @sleekstack/kit — agent guide

Effect-free dependency injection for TypeScript apps (React, Next.js). Validate every change with `npx sleekstack check` (exit 0 clean, 1 violations, 2 usage error); `npx sleekstack explain <CODE>` prints a code's rule and fixes.

## Entry points

- `@sleekstack/kit`: `tag`, `layer`, `withCleanup`, `effect` (side-effect Layer), `module`, `atom`, `cachedQuery`, `mutation`, `SleekStackError`.
- `@sleekstack/kit/next`: `configureRuntime`, `defineEffect`, `defineQuery`, `runOperation`, `query`, `fail`. (`effect` here is a deprecated alias of `runOperation`; do not use it.)
- `@sleekstack/kit/react`: `LayerProvider`, `useService`, `useServices`, `useAtom`, `useAtomValue`, `useAtomSet`, `useQuery`, `useMutation`, `useQueryClient`, `QueryProvider`.

## Patterns

```ts
import { layer, module, tag, withCleanup } from '@sleekstack/kit'

const Db = tag<{ query(sql: string): unknown }>('Db')
const Repo = tag<{ list(): unknown }>('Repo')

const DbLive = layer(Db, () => withCleanup(connect(), (c) => c.close()), [], { lifetime: 'app' })
const RepoLive = layer(Repo, function* () {          // yield* a Tag to depend on it
  const db = yield* Db
  return { list: () => db.query('select *') }
}, { lifetime: 'request' })

export const Data = module({ name: 'Data', provide: [DbLive, RepoLive], exports: [Repo] }) // Db is private
```

Next.js server action (a `'use server'` file may export only literal async functions):

```ts
'use server'
import { defineEffect, fail } from '@sleekstack/kit/next'
const add = defineEffect(function* (title: string) {
  const repo = yield* Repo
  return title ? repo.list() : fail('Title is required')   // resolves { ok, data } | { ok: false, error }
})
export async function addTodo(title: string) { return add(title) }
```

Call `configureRuntime({ provide: [AppModule] })` once (e.g. `instrumentation.ts`). Use `runOperation(gen, opts?)` / `query(gen, opts?)` for a one-off inline run; `opts.provide` shadows Layers for that call, `opts.scope: [Tags]` builds Tags the body never yields.

## Lifetime matrix

| Entry lifetime | May depend on |
| --- | --- |
| `app` | `app` |
| `request` | `app`, `request` |
| `component` | `app`, `component` |

Anything else is a `CaptiveDependency`. `request` and `component` never nest.

## Vocabulary

- **Tag**: a service token (`tag<T>(name)` or a class). **Layer**: how a Tag is built (`layer(...)`). **Module**: named group of Layers with `imports` and `exports`; unexported Tags are private to the module.
- **Lifetime**: `app` | `request` | `component`. **Shadowing**: a more local provider of a Tag overrides an outer one.
- **Kit Operation**: an action/query from `kit/next`; its deps are the Tags its generator `yield*`s.
- Avoid: "provider", "container", "registry", "injector"; say Layer, Graph, Module.

## Errors

<!-- generated:errors:start -->
- `MissingDependency`: Every Tag a service, action or component requires is provided by an entry in scope. Fix: Provide the Tag in this module or one it imports; Wrap the component in a Provide (or the mount layer) that supplies it.
- `DependencyCycle`: Services may not require each other in a cycle. Fix: Break the cycle: move the shared part into a third service both depend on.
- `AmbiguousProvider`: At most one provider of a Tag sits at each locality, so Shadowing can pick one. Fix: Remove one of the providers; Move one provider into an imported module so the closer one shadows it.
- `ModuleCycle`: Modules may not import each other in a cycle. Fix: Extract the shared entries into a module both import.
- `DuplicateModule`: Each module name belongs to one module. Fix: Rename one of the modules; Import the existing module instead of declaring a second one.
- `CaptiveDependency`: A service may only depend on services that live at least as long (app may not capture request or component). Fix: Shorten the dependent service lifetime; Lengthen the dependency lifetime.
- `PrivateDependency`: Only Tags a module exports are visible outside it. Fix: Add the Tag to the module exports; Depend on an exported service instead.
- `UnownedAction`: With several runtimes, each action is imported by exactly one configureRuntime file. Fix: Pass --entry to pick the runtime; Import the action from the file that calls configureRuntime.
- `EmittedSibling`: Emitted .js/.d.ts output does not sit next to its .ts source. Fix: Delete the emitted file; Set outDir (or noEmit) in tsconfig.
- `Unresolvable`: Every declaration in the graph is statically readable; the analyzer fails closed. Fix: Use a literal or a direct reference instead of a computed value; Annotate the value with its Layer type.
- `Computed`: Provide lists, imports and names are statically evaluable (literals, local consts, loops over literal lists). Fix: Replace the computed expression with a literal list or a local const.
- `UnnamedEffect`: effect() in a module has a literal name, so its graph identity is static. Fix: Pass a string literal `name` to effect().
- `NonLiteralOptions`: runEffect options are statically readable. Fix: Pass the options as an object literal at the call.
- `Unresolved`: Every component and Layer in a mount tree is statically readable (no any, no dynamically picked component). Fix: Type the component or Layer explicitly; Render the component directly instead of picking it at run time.
- `UnhandledError`: Every tagged error a component can fail with is caught before mount. Fix: Wrap the component in a Catch for the error tag; Handle the error inside the component.
- `EffectInsideReact`: Effect components are not rendered under a fromReact guest. Fix: Move the Effect component out of the React guest; Convert the guest subtree to Effect components.
- `NonResumableHandler`: Every on() entry names a top-level const defineHandler("literal-id", ...), and resume loaders import a module whose default export is one. Fix: Hoist the defineHandler call to a top-level const with a string-literal id; Pass that const to on() instead of an inline function or a reassigned variable.
<!-- generated:errors:end -->
