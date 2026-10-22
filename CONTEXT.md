# SleekStack

A runtime architecture layer that adds structured dependency management, component-scoped service graphs, and request-scoped server environments on top of Effect TS.

## Language

### Service graph concepts

**Tag**:
An Effect `Context.Tag<T>` that uniquely identifies a service within the runtime. Users define tags using Effect's API directly; SleekStack does not wrap them.
_Avoid_: Token, ServiceTag, identifier, key

**Layer**:
An Effect `Layer` that describes how to construct one or more services, including their resource acquisition and cleanup. Users write layers using Effect's API directly; SleekStack does not wrap them.
_Avoid_: Provider, factory, ServiceProvider

**Service**:
The resolved runtime value obtained by providing a Tag to `useService()`. Distinct from the Tag (the identifier), the Layer (the constructor), and the Declared Layer (a Layer plus its lifetime).
_Avoid_: Instance, dependency, singleton

**Declared Layer**:
The output of `declareLayer(layer, { lifetime? })` — a plain Effect Layer plus its Lifetime. What it provides and requires is read from the Layer's type by the Analyzer; the runtime keeps no such metadata. Core has no Effect-hiding builders: everything it accepts is a Layer.
_Avoid_: Service Definition, `service()`, provider definition

**Lifetime**:
One of `app`, `request`, or `component` — how long a constructed service lives before it is finalized. Constrains which lifetimes may depend on which (the lifetime matrix: `app` on `app`; `request` on `app`+`request`; `component` on `app`+`component`; `request` and `component` never nest).
_Avoid_: Scope kind, duration, lifecycle tier

**Module**:
A named group of entries — declared Layers or bare Layers — with imports (other Modules, pulled in transitively) and exports. Exports are enforced: when `exports` is given, every other Tag the Module provides is private and may be required only by the Module's own entries — importers, root entries, `useService`, action/query deps, per-call `provide` entries and child scopes get `PrivateDependency` from the Analyzer (the runtime does not enforce it). Omitted `exports` means all public. Shadowing a private Tag from outside provides a new public one (ADR 0006). The primary architectural unit in SleekStack. Created with `module()`.
_Avoid_: Package, bundle, plugin, feature

**Graph**:
The dependency structure of every entry and imported Module under a root (a `configureRuntime` app root, or a Request Root or Overrides Root): nodes, edges, lifetimes, module privacy and shadowing. Validated only by the Analyzer, at build time (ADR 0011); `sleekstack check --json` reports it (one node per provided Tag, keyed by the Tag key, or `Tag@Module` when shadowed). The runtime keeps no Graph at all: it builds entries in position order (deepest import first, root entries last), so a later, more local entry overrides an earlier one.
_Avoid_: Dependency tree, container, registry

**Captive Dependency**:
A lifetime-safety violation where a longer-lived entry would depend on a shorter-lived one (e.g. `app` on `request`), which would otherwise capture a stale or already-finalized instance. Reported by the Analyzer per the lifetime matrix, naming both services and their lifetimes.
_Avoid_: Lifetime leak, scope violation

**Analyzer**:
`@sleekstack/analyze`, run as `sleekstack check [--project <tsconfig>] [--entry <file>...] [--json] [--lenient]`. Reads the declarations through the TypeScript checker without executing app code, builds each root's Graph and reports every violation with file:line (exit 0 ok, 1 violations, 2 crash or no roots). Fails closed: a declaration it cannot read is an error. `--entry` limits the roots to the given files. `--lenient` turns an unresolvable `runEffect` Layer into an opaque root (`kind: 'opaque'`) instead of an error; it never excuses a missing Tag or an unresolvable app Layer.
In a project whose package.json lists `@sleekstack/ui`, `sleekstack check` also runs the component pass (`analyzeComponents`): one tree per `mount` call, reporting `MissingDependency`, `UnhandledError`, `EffectInsideReact`, `Unresolved`, `NonResumableHandler`, `ConditionalSlot` and `MissingKey` (`components` under `--json`). `resume` calls are tree roots too.
_Avoid_: Linter, compiler plugin

**Request Root**:
A Graph root made from the `request` Layer of a `runEffect({ request })` call (each Layer-valued branch is its own root). Checked against its own provides plus any `configureRuntime` app root, so needing an app singleton is not a missing dependency; its leaves have lifetime `request`. Reported with `kind: 'request'`; app roots are listed first with `kind: 'app'`.
_Avoid_: Request graph, sub-graph

**Overrides Root**:
A Graph root made from the `overrides` Layer of a `runEffect({ overrides })` call, checked like a Request Root but keeping its typed lifetimes. Reported with `kind: 'overrides'`.
_Avoid_: Override graph, patch layer

**Position Order**:
Core's construction order for a scope: entries flattened deepest import first, then importers, then root entries; each builds over what was built before and a later one overrides an earlier one. Nothing is validated; a Layer that needs a Tag not built yet fails with `MissingDependency`.
_Avoid_: Resolution Plan, Graph, snapshot

**Shadowing**:
The mechanism by which a Layer or Module in a `provide` array overrides a transitive dependency introduced by a Module's `imports`. No separate override API exists — shadowing is implicit when the same Tag is satisfied by multiple entries. It is per Tag: a local entry can shadow one output of a multi-Tag declared Layer, and the Analyzer reports `AmbiguousProvider` only when two providers have equal precedence. At run time the later entry in Position Order wins.
_Avoid_: Overriding, mocking, replacing, substituting

**Atom**:
A lazy, reactive value defined once at module level: plain writable state, a function of other atoms (read through `get`), an Effect, or a Stream. It holds no state itself; its state lives in an AtomStore. Modeled on effect-atom (ADR 0008).
_Avoid_: Signal, observable, store

**AtomStore**:
The container of atom state and subscriptions owned by each `mount` and bound to its Scope: it resolves an atom's services through that scope and is disposed with it. It is effect-atom's Registry under a name that avoids "registry".
_Avoid_: Registry, atom registry, atom context

**Result**:
The state of an Effect or Stream atom: `Initial`, `Success` or `Failure` (holding a Cause), each with a `waiting` flag while it reloads. Components read it through `useAtomValue`, `<Pending>` and `Catch`.
_Avoid_: AsyncData, RemoteData, status

**Serializable Atom**:
An Atom opted in to SSR with a stable key, a `Schema` and an explicit kind: `Atom.serializable` (the schema describes the value) or `Atom.serializable.result` (the value is a Result; the schema describes its `Success` value). Only Serializable Atoms enter a Snapshot. Keys are unique per AtomStore (ADR 0016).
_Avoid_: Persisted atom, hydratable atom

**Snapshot**:
The `Record<key, encoded value>` of the settled Serializable Atoms built in an AtomStore (`dehydrate`), sent from the server and used to seed a client AtomStore before the first read (`hydrate`). Result atoms enter it only on `Success`. It is JSON-safe only when each schema encodes to JSON values (a `bigint` encoding breaks the transport). Distinct from the query layer's Dehydrated State.
_Avoid_: Payload, atom state

### UI framework concepts (`@sleekstack/ui`)

**Component** _(ui)_:
A function `(props: P) => Effect<Node, E, R>`: `R` is the Tags it needs, `E` its tagged errors, `Node` a small renderable tree (text, element, fragment, guest, reactive). Each call is an instance with a run-time id (per-function id plus ordinal, or key), so its local state and subscriptions survive re-runs. Unrelated to the `component` Lifetime.
_Avoid_: Effect component, view, widget

**Host**:
The Effect program that renders a tree of Components. Components run only in the Host; a Component is never rendered inside a React component (ADR 0015).
_Avoid_: Shell, root component

**Guest**:
A plain React component wrapped by `fromReact`, a `Component<P, never, never>` leaf. React renders it with its own `react-dom`; it receives no Effect context and its subtree is opaque. A Component under a Guest is an `EffectInsideReact` error.
_Avoid_: embedded React

**Handler** _(ui)_:
A named Effect program run on a DOM event, declared at module top level as `const h = defineHandler('id', (event) => ...)` and attached with `on(node, { click: h })`. The server emits only its id; `resume` loads its chunk on first use. A handler the Analyzer cannot prove is such a reference is a `NonResumableHandler` error (ADR 0017). Used only for `resume`; client-rendered trees use event closures (a function `onXxx` prop run with the element's context).
_Avoid_: Event listener, callback, action

**Form Action** _(ui)_:
A host `<form>`'s `action` prop: a function, generator, Effect or `defineHandler` run on submit with an `ActionEvent` (`formData` built at dispatch); the browser submit is prevented (ADR 0033). `useAction` binds one to a `Result` atom. Distinct from a Server Function, the server operation.
_Avoid_: Server action, submit handler

**Resume**:
`resume({ container, layer, handlers, atoms })`: makes server-rendered host HTML interactive without running any Component. It seeds its own store from the Manifest, keeps `bind` text in sync and runs Handlers through one queue with `layer`. Distinct from `hydrateMount`, which runs component code, and from atom-store `hydrate`, which only seeds a Snapshot (ADR 0017).
_Avoid_: rehydrate, boot. Not Hydrate: `hydrateMount` runs components and adopts the server DOM (see Hydrate Mount).

**Hydrate Mount**:
`hydrateMount(app, { layer, container, onError?, store? })`: runs a host tree once on the client against `renderToString` output and adopts the server DOM instead of rebuilding it. Seeds state from the `<script data-sleek-hydrate>` payload. Distinct from Resume (no component runs) and from atom-store `hydrate` (seeds a Snapshot only). ADR 0015.
_Avoid_: rehydrate, revive

**Manifest**:
The one `<script data-sleek-manifest>` that `renderToString` emits: the delegated event types and each bind key's encoded atom value. Only serializable value-kind atoms enter it; a bad entry fails `resume` with `ManifestDecodeFailed`. Not a Snapshot.
_Avoid_: Payload, state blob, Snapshot

**Mount**:
`mount(app, { layer, container, onError? })` (DOM) or `renderToString(app, { layer })` (string): runs a tree with a fully satisfied Layer. A failure in `E` rejects with the original error. Each `mount` call is one Analyzer tree; a later `mount` on the same container wins.
_Avoid_: Render root, hydrate

**Provide**:
`Provide(layer, children)`: provides a Layer to a subtree, removing its Tags from the subtree's `R`.
_Avoid_: Context provider

**Catch**:
`Catch(tag, fallback, children)`: renders `fallback` for one tagged error and removes only that tag from `E`.
_Avoid_: Error boundary, try

**Pending**:
`<Pending fallback>{children}</Pending>`: an instance that renders `fallback` while its children wait on an async Effect (such as `useSuspenseQuery`), then the children. A re-run keeps the previous content until the new content resolves; `renderToString` awaits the content and never emits the fallback. `renderToStream` emits the fallback in the shell and the content later as a chunk (ADR 0023). A content error goes to the enclosing `Boundary` (ADR 0015).
_Avoid_: Suspense, loading provider, provider

**Transition**:
`startTransition(() => store.set(a, v))`: writes whose re-runs keep the previous DOM over a `Pending` that has no content yet, instead of showing `fallback`, until the new content commits. Built on core's `markedWrites`. A flag, not a scheduler: no lanes, no interruption (ADR 0034). `useDeferredAtom(source)` is its companion: an instance-owned atom that follows `source` one commit later.
_Avoid_: concurrent render, lane, priority

**Portal**:
`<Portal container={el}>{children}</Portal>`: renders its children into another DOM container while keeping the `Provider` layers and `Store` of its position in the tree; removed with its owner. Renders nothing on the server.
_Avoid_: Teleport, createPortal

**Store** _(ui)_:
The `Store` Tag over core's `AtomStore`, one per `mount`. A host component that reads an atom through `useAtomValue` / `useAtom` re-runs when it changes; the Reconciler patches its subtree and matched guests keep their React state (ADR 0015).
_Avoid_: State, signal

**Reconciler**:
The DOM renderer's patch step: it matches a new run's Node tree against the Live tree (keyed and unkeyed pools), patches elements in place, adopts matched instances and guests and removes the rest.
_Avoid_: Diff, virtual DOM

**Live tree**:
The renderer's record of what is mounted: DOM nodes, instances with their run scope and slots, guest roots and event bindings. The Reconciler patches it.
_Avoid_: Fiber tree, shadow tree

**Key** _(ui)_:
The `key` prop on an element or component: its identity among siblings, so it is matched across re-runs and moves. Two siblings with one key raise `DuplicateKey`.
_Avoid_: "key" alone where it could mean a Tag key or a bind key; say "key prop"

**Local state**:
`useLocal(initial)`: an ordered slot of one instance, held as a writable atom in the Store. Kept across re-runs, released when the instance is removed; must be a top-level call (`ConditionalSlot`), and a slot count change is `SlotMismatch`.
_Avoid_: Hook state, useState

**Router**:
`@sleekstack/router` (ADR 0036): a const route table with params typed from path strings, a page per route, loaders (`loader` / `useLoader`), actions, prefetching `Link`, `redirect` / `notFound` as control flow, the server entry `handle` and the browser entry `startRouter`.
_Avoid_: ui-router

**Render Observer** _(ui)_:
The optional `observe` callback of `mount` / `hydrateMount` (`RenderObserver`). It receives Render Events and never changes what renders; with none attached the renderer builds no events. Effect events reach it through the `EffectObserver` context reference, provided only by an observed mount.
_Avoid_: Profiler, hook, listener

**Render Event** _(ui)_:
A plain-data record the Render Observer receives: `create`, `adopt` (hydration; resume adopts no instances), `rerun` with its reasons, `dispose`, `slot` and `effect` (`start`, `restart`, `cleanup`). It carries the mount id and an instance id, never a live instance, so a disposed instance is not retained.
_Avoid_: Trace entry, instance reference

### Request and runtime concepts

**Request Scope**:
A server-side Scope created per `runEffect` call (`@sleekstack/runtime`) or per Server Function call. Isolates services (auth, tracing, transactions) so no state leaks between requests.
_Avoid_: Request context, request environment, request runtime

**Runtime Package**:
`@sleekstack/runtime`, the framework-agnostic Effect app runtime: `configureRuntime`, `runEffect`, `getRuntime`, the `onError` sink and a pluggable `isControlFlow` classifier (default: nothing is control flow). `@sleekstack/runtime/devtools` is the framework-agnostic devtools feed handler (ADRs 0013, 0049). `@sleekstack/runtime/internal` is for sibling packages only.
_Avoid_: server runtime

**Devtools**:
The dev-only introspection of a running app: a bounded event buffer in `@sleekstack/runtime` (per-service acquire/release, fiber id, owning scope) served by `devtoolsHandler` from `@sleekstack/runtime/devtools`, rendered by the `@sleekstack/devtools` panel, a `@sleekstack/ui` component (`SleekStackDevtools`: graph roots, live scopes, services, atoms of every open AtomStore, errors linked to their scope, queries), and for `@sleekstack/ui` mounts `uiTrace()` with `<UiPanel>` (instance tree, atoms per instance, re-run reasons, effect runs) fed by a Render Observer. In production recording is off and the handler returns 404; the panel is excluded from production client chunks when mounted behind a dynamic import.
_Avoid_: Inspector, debug panel

### Start concepts (`@sleekstack/start`)

**Server Function**:
A server operation for ui apps, declared with `serverFn(id, { input, success, error? })(function* ...)` and listed in `start({ functions })` (ADR 0039). It runs in a Request Scope, served at `POST /_sleek/fn/<id>`: input decoded before the body, output encoded with the success Schema, the declared error typed across the wire. The browser calls it through a `client(contract)` stub built from the same Schemas. Distinct from a Form Action (the ui submit handler, which a stub can be).
_Avoid_: Action, Server Action, RPC, procedure

**Server Service**:
A Context Tag whose methods are Effect signatures, declared with `ServerService(id)<Self, Shape>()` in a client-safe file and implemented by a Layer in a `*.server.ts` file (ADR 0051). A page calls `yield* Profiles`: on the server the implementation runs in-process, in the browser a generated client calls `POST /_sleek/fn/<id>.<method>`. The client and registry are generated from the method types. An implementation Layer is built with `implement(Tag, methods)`, whose methods may use the request services (ADR 0052). Distinct from a Server Function (explicit Schemas, one operation, `serverFn`).
_Avoid_: remote service, RPC, contract

**Server Endpoint**:
A route handler given to `start({ handlers })` at an exact pathname: one Effect per HTTP method, answering the request with a `Response`, with the request services (`Request`, `Cookies`, `ResponseHeaders`) in the Request Scope (ADR 0039). An unsupported method is 405 with `Allow`.
_Avoid_: API route, controller

### Docs site concepts (`apps/docs`)

**Docs Site**:
The documentation site: a `@sleekstack/ui` app built to static pages by `@sleekstack/ui-vite` (ADR 0048), served by `@sleekstack/start` only in dev. Guides are MDX under `content/docs` ordered by `meta.json`; the API reference is generated by TypeDoc into a gitignored tree; search reads a build-time index. Pages sit under a base prefix (`VITE_DOCS_BASE`, default `/docs`).
_Avoid_: Fumadocs site, docs app

### Query cache concepts

**Cached Query**:
A keyed, cached async read: TanStack Query (ADR 0018). In Effect code it is a `queryOptions({ queryKey, queryFn: effectFn(effect) })` read with TanStack's hooks under `QueryProvider`. `@sleekstack/query/ui` has `useQuery` for ui components.
_Avoid_: resource, loader

**Query Client**:
The TanStack `QueryClient` behind `QueryClientTag`, built by the scoped `QueryClientLive` Layer: one per scope that provides it, unmounted and cleared when that scope closes. `effectFn` runs with the services of the layer that built it.
_Avoid_: Query store

**Mutation**:
A write through TanStack's `useMutation` (or `@sleekstack/query/ui`'s `useMutation`). Optimistic writes are TanStack's `onMutate` / `onError` / `onSettled`. Distinct from a Server Function, the server operation a mutation often calls.
_Avoid_: Command, action (for the client write)

**Dehydrated State**:
TanStack's `DehydratedState`, dehydrated from the server's Query Client and given to the client's.
_Avoid_: Snapshot, serialized cache

### Model and Draft concepts

The contract is ported from ramcinpay-front (`ModelSpec`, `DraftSpec`, `useDraftForm`), which took the idea of a record and its editable copy from EmberData (ADR 0038).

**Model**:
The shape a view renders, built from a read wire shape by a pure `fromDto(dto, ctx)` (`ModelSpec<Dto, M, Ctx>`, a type in `@sleekstack/model`). `ctx` is resolved data the DTO does not carry, never a Service or client. The read direction (`fromDto`) and the write direction (a Draft Spec) meet at the Model; neither is the inverse of the other, so there is no `toDto(model)`.
_Avoid_: DTO mapper, entity

**Draft Spec**:
`DraftSpec<D, Dto, Src, P, E, R>` (a type in `@sleekstack/model`): the write direction of a Model. `schema(src)` validates the Draft (its Type and Encoded are both `D`, so a field holds what its input holds; no coercion), `create(src)` seeds it, and `toDto(draft, src)` is an Effect of the write body whose ambients are Services in `R` and whose failures are `E`. Optional `toModel(draft, src)` projects a Draft into a read shape (`preview`, or the `apply` of `useOptimistic`); optional `diff(base, next)` is a minimal PATCH body. All but `toDto` are pure.
_Avoid_: DTO mapper, form schema

**Draft** _(model)_:
An editable copy of a Model, one save boundary: what `useDraft(spec, src)` (`@sleekstack/model`) returns, as atoms in the component's Store held by one slot of the instance (`value`, `field(name)`, `errors`, `valid`, `dirty`, `preview`, `changes`, `reset()`, `toDto()`). It starts as `spec.create(src)`; `src` is a value or an atom. While pristine (equal to its seed by the schema's equivalence) it re-seeds when the source changes; after an edit it keeps the edits. Released with the instance.
_Avoid_: form state, form model

**Record Type**:
A server record kind made by `defineRecord(type, { fields, adapter? })` (`@sleekstack/model`, ADR 0041): Effect Schema fields with a string `id`, Transformations on fields, `ref` and `refs` relationship fields, and the Record Adapter Tag that loads and saves it. Its records live in the Identity Map; `record.useDraft(id)` derives a Draft from one, and `commit(id, draft)` saves it. A record and its Draft are two objects: an edit never touches the shared record.
_Avoid_: Entity, `Record` (as a name), model class

**Identity Map**:
One slot per Record Type and id in each Store, so every `push`, `find` and `commit` of one record writes the same atom and every view reads one value. A record stays until the Store is disposed or `evict(id)`. Client-only: after SSR it refills from the Query cache through `queryOf(record)`.
_Avoid_: record store, record cache

**Transformation** _(model)_:
One field's wire format, made by `defineTransformation(name, options => ({ from, to, hydrate, serialize, defaultValue }))` and attached as `field(Money, { currency })`. `hydrate` runs when wire data becomes a record, `serialize` when a Draft becomes a change; both fail with a `ParseError`. It reads one field only; a value computed from several fields is a derived atom.
_Avoid_: serializer, transform registry

**Record Adapter**:
The wire contract of one Record Type: an app-written Service (`RecordAdapter`, behind an app-declared `Effect.Tag`, supplied as a Layer) whose `find(id)` and `save(id, change)` remove the response envelope and shape the request and PATCH bodies. Swapping REST for GraphQL changes only its Layer; a missing one shows in `R`.
_Avoid_: serializer, HTTP client, data source

**Record Reference**:
One entry of a relationship: `RecordRef { id, value }`, the target's id as the owner holds it and the target record (`None` until it is in the Identity Map). `record.related(id, field)` is a derived atom of them that follows the owner and every target and never fetches; a missing target keeps its id and position.
_Avoid_: `Ref` (Effect's), association, foreign key

**Head**:
The `<Head>` component of `@sleekstack/ui` (fn-33, ADR 0044): `title`, `meta` and `link` elements that land in the document head, deduped by key with the deepest `Head` winning, removed when their component unmounts. `renderToString` and `renderToStream` hand them to `onHead`; a stream patches later changes with an inline script; `mount` patches its document's head and `hydrateMount` adopts the server's tags.
_Avoid_: Helmet, document head manager

**HeadSink**:
The `Context.Reference` holding where a mount's `Head` tags go (`@sleekstack/ui`, a `HeadTarget`): `mount` provides its container document's head; unset, `Head` does nothing. String and stream renders read the tags off the output node instead. Not the `Collector` of `reactive.ts` or `string.ts`.
_Avoid_: head collector

**Prerender**:
`vite build` with `sleekContent({ prerender })` (`@sleekstack/ui-vite`, ADR 0047): each page route rendered with `renderToString` to `<route>/index.html`, plus the search index and Open Graph images. Plain static files, no server logic.
_Avoid_: SSG, static export
