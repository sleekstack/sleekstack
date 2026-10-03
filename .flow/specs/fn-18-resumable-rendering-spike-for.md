## Goal & Context
<!-- scope: business -->

Explore resumability for `@sleekstack/ui`. ADR 0010 rejected Qwik-style resumability because it cannot run arbitrary React components. ADR 0015 changes that premise for Effect-native components: a component is `(props) => Effect<Node, E, R>`, a function of its props and Layers with nothing hidden in a React closure. This spike asks one question: **can a server-rendered host-first tree become interactive on the client without re-running its components, by loading only the handler the user triggers?**

It is a spike, like fn-15. It answers the question with a working demo, a measured client runtime size and an ADR. It is not a replacement for Islands and makes no promise about React guests.

Today the renderers reject `on*` attributes and components have no state or events, so there is nothing to resume yet. This spec adds the smallest event and state model that makes resuming meaningful, then resumes it.

## Architecture & Data Models
<!-- scope: technical -->

- **Handler** = a named Effect program registered at module level: `defineHandler(id, (event: HandlerEvent) => Effect<void, E, R>, opts?)`. The id is a stable string. It is the only thing the server emits for an event, so it is the unit that can load lazily. This mirrors the explicit `defineIslands` registry of ADR 0010: no compiler, no closure serialization.
- **HandlerEvent** is a serializable snapshot taken when the event fires: `{ type, value?, checked?, key? }`. The DOM event is gone by the time a lazy chunk has loaded, so a handler never receives it. `preventDefault` and `stopPropagation` are declared statically in `opts`, not called in the handler.
- **Node** gains two optional element fields: `on: Record<eventName, HandlerRef>` and a `Bind(atom)` text node. `on*` attributes stay rejected. A `HandlerRef` is `{ id }` only.
- **State** lives in native atoms from `@sleekstack/core`. A `Bind(atom)` node renders the atom's current value as text and, on the client, subscribes to the atom. Handlers write atoms; nothing re-runs a component. Server atom values reach the client through the fn-17 dehydrate/seed API when it has landed; until then the spike seeds the demo's atom values through the manifest by hand.
- **Server output**: `renderToString` emits plain HTML plus, for each handler, `data-sleek-on-<event>="<id>"`, for each bind `data-sleek-bind="<atomKey>"`, and one `<script type="application/json" data-sleek-manifest>` carrying `{ v: 1, atoms: { <key>: <encoded value> } }`. The manifest is escaped so it cannot close the script element (`<`, `>`, `&`, U+2028 and U+2029 as `\uXXXX`).
- **Client** `resume({ container, layer, handlers })` reads the manifest, seeds an AtomStore, then installs one delegated listener per event type found in the container. `handlers` is `Record<id, () => Promise<{ default: Handler }>>`, so each handler is a lazy chunk. On an event it finds the closest `[data-sleek-on-<event>]`, loads that handler once, runs it in a client Scope with `layer`, and applies the declared `preventDefault`. It never calls a component function and never calls `mount`. `resume` returns `{ dispose(): Promise<void> }`, which removes the listeners and closes the Scope.
- **Analyzer**: a node's `on` entry must be a reference to a `defineHandler` call. An inline function, a computed id or a handler built in a loop reports `NonResumableHandler` at file:line (fail closed). A handler's `R` must be provided by the layer passed to `resume`; a miss reports the existing `MissingDependency`. The check lives in the ui component pass of `@sleekstack/analyze`.
- **Guests**: `fromReact` guests are opaque and are not resumable. Under `resume` their server DOM stays inert. Hydrating them (Islands style) is out of scope.

## API Contracts
<!-- scope: technical -->

```ts
interface HandlerEvent { readonly type: string; readonly value?: string; readonly checked?: boolean; readonly key?: string }
interface HandlerOptions { readonly preventDefault?: boolean; readonly stopPropagation?: boolean }
defineHandler<E, R>(id: string, run: (event: HandlerEvent) => Effect<void, E, R>, opts?: HandlerOptions): Handler<E, R>

el(tag, attrs?, ...children): Node            // unchanged
on(node: Node, events: Record<string, Handler<any, any>>): Node
bind<A>(atom: Atom<A>, key: string): Node      // text node, key names it in the manifest

resume<R, LE>(opts: {
  container: Element
  layer: Layer<R, LE, never>
  handlers: Record<string, () => Promise<{ default: Handler<any, R> }>>
  onError?: (cause: Cause<unknown>) => void
}): Promise<{ dispose(): Promise<void> }>
```

- `defineHandler` throws `DuplicateHandler` (tagged error) when the id is already registered. `resume` rejects with the original layer error (never a `FiberFailure`), as `mount` does.
- A click on an element whose id is missing from `handlers` calls `onError` with an `UnknownHandler` tagged error and does nothing else. A handler failure calls `onError` and leaves the DOM as it was. Neither stops later events.
- A handler chunk loads once; concurrent events for the same id wait for that one load and then run in event order.

## Edge Cases & Constraints
<!-- scope: technical -->

- Events before `resume()` runs are not replayed (Islands replays its first click; this spike does not). Recorded in the ADR as a known gap.
- A manifest value that fails to decode rejects `resume` with a typed error naming the atom key; the container is left untouched.
- A second `resume` on the same container is a no-op that returns the first handle. `dispose` then a new `resume` works.
- `bind` keys are unique per render; a duplicate key fails `renderToString` with a tagged error.
- Text from atoms and attributes is escaped by the renderers exactly as today. Nothing in the manifest or `data-sleek-*` attributes is evaluated as code, and handler ids are looked up in the `handlers` map only (never as import paths).
- `mount` (the DOM renderer that re-mounts the whole tree) is unchanged. `resume` and `mount` are separate entry points over the same Node tree.
- Client runtime budget is measured, not fixed: the spike reports the gzipped size of `resume` plus the delegation runtime.

## Acceptance Criteria
<!-- scope: both -->

- [ ] **R1:** `defineHandler`, `on` and `bind` exist; `renderToString` of a tree using them emits `data-sleek-on-<event>`, `data-sleek-bind` and one escaped manifest script, and still rejects `on*` attributes.
- [ ] **R2:** `resume` over server-rendered HTML attaches handlers without calling any component function or `mount`: a test counts component calls and asserts zero after resume.
- [ ] **R3:** A handler loads lazily: a test asserts its loader has not run before the first matching event and runs exactly once across several events, with concurrent events run in order.
- [ ] **R4:** A handler runs as an Effect with the `resume` layer's services, writes an atom, and the bound text node updates; the handler receives a `HandlerEvent` snapshot, and `preventDefault` declared in `opts` is applied.
- [ ] **R5:** Error cases: `UnknownHandler`, a failing handler, a manifest that fails to decode, `DuplicateHandler`, a duplicate `bind` key and a second `resume` on one container behave as in Edge Cases; each is tested.
- [ ] **R6:** The Analyzer reports `NonResumableHandler` (inline function, computed id, handler built in a loop) and `MissingDependency` for a handler whose `R` the `resume` layer does not provide, each with file:line, and passes a clean fixture.
- [ ] **R7:** `apps/ui-demo` has a counter component: server-rendered, then resumed in a jsdom test with a lazy handler chunk and a bound count.
- [ ] **R8:** ADR 0017 (Proposed) records the question, the design, the measured gzipped client runtime size, the known gaps (no replay of pre-resume events, guests not resumable, no `mount` reuse), and a yes/no answer with next steps. `CONTEXT.md` gains Handler, Resume and Manifest, each with an `_Avoid_` line.

## Boundaries
<!-- scope: business -->

Out of scope: hydrating or resuming `fromReact` guests; replaying events that fire before `resume()` runs; an inline loader script and prefetch strategy; keyed list diffing or any update that is not an atom-bound text node; compiler-extracted handlers; per-handler Scopes and interruption; Next.js or RSC; serialization of anything except atom values; the docs site API reference. Not changing ADR 0010: Islands remain the path for React components.

## Decision Context
<!-- scope: both -->

- **Explicit handler registry** (chosen): handlers are named module-level Effects, as Islands are named in `defineIslands`. It is checkable by the Analyzer and needs no compiler.
- **Qwik-style closure serialization** (rejected): needs a compiler that rewrites closures, and the Analyzer could not read requirements from the Effect types any more.
- **Re-run the tree on the client** (rejected): that is hydration; it is what resumability avoids.
- **Depends on fn-17** (atom SSR and hydration) for dehydrate/seed. The spike hand-seeds one number if fn-17 has not landed, so it is not blocked.
- **Open decision carried from ADR 0015**: whether ui sits beside kit or later replaces its React side. This spike's result informs it and does not settle it.
