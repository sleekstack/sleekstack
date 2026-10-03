## Goal & Context
<!-- scope: business -->

Explore resumability for `@sleekstack/ui`. ADR 0010 rejected Qwik-style resumability because it cannot run arbitrary React components. ADR 0015 changes that premise for Effect-native components: a component is `(props) => Effect<Node, E, R>`, a function of its props and Layers with nothing hidden in a React closure. This spike asks one question: **can a server-rendered host-first tree become interactive on the client without re-running its components, by loading only the handler the user triggers?**

It is a spike, like fn-15. It answers the question with a working demo, a measured client runtime size and an ADR. It is not a replacement for Islands and makes no promise about React guests.

Today the renderers reject `on*` attributes and components have no state or events, so there is nothing to resume yet. This spec adds the smallest event and state model that makes resuming meaningful, then resumes it.

## Architecture & Data Models
<!-- scope: technical -->

- **Handler** = a named Effect program: `defineHandler(id, run, opts?)` returns a plain `Handler` value `{ id, run, opts }`. There is no global registry, so a module evaluated twice (HMR, a test re-import) cannot throw. The `id` must be a string literal and the call must sit at module top level (the Analyzer enforces both). Handler ids are the only thing the server emits for an event, so they are the unit that loads lazily. This mirrors the explicit `defineIslands` registry of ADR 0010: no compiler, no closure serialization.
- **HandlerEvent** is a serializable snapshot taken synchronously at dispatch: `{ type, value?, checked?, key? }`. `value` and `checked` are read only when the target is an input, textarea or select; any other target (including a form `submit`) gets `type` only. The DOM event is gone by the time a lazy chunk has loaded, so a handler never receives it.
- **Static event flags.** `preventDefault` and `stopPropagation` are declared in `opts` and **also emitted by the server** (`data-sleek-pd-<event>`, `data-sleek-sp-<event>`), because the delegated listener must apply them synchronously, before any chunk loads.
- **Node** gains an optional element field `on` (event name to `Handler`) and a `Bind` text node. `on*` attributes stay rejected; `data-sleek-*` names are written by the renderer only and are rejected when a user puts them in `attrs`.
- **Bubbling events only.** `on()` accepts events that bubble. `focus`, `blur`, `mouseenter`, `mouseleave`, `load`, `scroll` and other non-bubbling events are rejected with a tagged error; `focusin` / `focusout` replace focus / blur.
- **State** lives in native atoms (`@sleekstack/core`). Each bound atom has one key. `bind(atom, key)` renders the atom's current value as text; several `bind` nodes may share an atom, and two different atoms with one key fail. Handlers write atoms; nothing re-runs a component.
- **Manifest.** One `<script type="application/json" data-sleek-manifest>` holding `{ v: 1, events: string[], atoms: Snapshot }`, where `atoms` is a record of key to encoded value (the shape fn-17 defines). The codec is JSON for the spike; fn-17's Schema codec is used when it has landed. The script content is escaped so it cannot close the element (`<`, `>`, `&`, U+2028, U+2029 as `\uXXXX`). Unlike fn-17's `hydrate`, which drops a bad entry with a warning, `resume` rejects when a bound atom's value fails to decode: a wrong seed would render a wrong page.
- **Client** `resume({ container, layer, handlers, atoms })`:
  1. reads exactly one manifest from the container and creates its own `AtomStore`, seeded from `atoms` (the `atoms` option maps each manifest key to its Atom; `resume` owns and disposes the store);
  2. subscribes every `data-sleek-bind` text node to its atom before any event can fire;
  3. installs one delegated listener per event type listed in the manifest;
  4. on an event, applies the static flags synchronously, snapshots the event, finds the **closest** `[data-sleek-on-<event>]` element only (no walk up the tree), and queues the run.
  `handlers` maps each handler id to a lazy loader `() => Promise<{ default: Handler }>`; the loaded handler's own `id` must equal the map key. Runs go through **one FIFO queue per `resume`**, so event order is run order across all ids; chunk loads may overlap, runs never do. Each run is an Effect with `layer` in a client Scope. `resume` never calls a component function and never calls `mount`.
- **Activation token.** `dispose`, or a second `resume` after dispose, invalidates the token. A chunk load or queued run that finishes after that checks the token and does nothing. `dispose` closes the Scope (interrupting forked fibers), disposes the store and removes listeners.
- **Analyzer.** The component pass gets a second tree root at `resume` calls, next to `mount`. For each entry of the `handlers` map it reads `R` from the awaited `default` type of the loader and checks it against the call's `layer` (existing `MissingDependency`). `NonResumableHandler` is reported when an `on` entry is not a reference to a top-level `defineHandler` with a literal id, when the id is computed or the handler is built in a loop or inline, and when a loader's `default` type cannot be read (fail closed). The existing skips for yields inside `Effect.all` and nested guest props apply to the new root too.
- **Guests**: `fromReact` guests are opaque and not resumable. Under `resume` their server DOM stays inert. Hydrating them (Islands style) is out of scope.
- **Dependency**: `@sleekstack/ui` gains a dependency on `@sleekstack/core` for atoms. The `resume` entry must not pull in React.

## API Contracts
<!-- scope: technical -->

```ts
interface HandlerEvent { readonly type: string; readonly value?: string; readonly checked?: boolean; readonly key?: string }
interface HandlerOptions { readonly preventDefault?: boolean; readonly stopPropagation?: boolean }
interface Handler<E = never, R = never> { readonly id: string; readonly run: (event: HandlerEvent) => Effect<void, E, R>; readonly opts: HandlerOptions }
defineHandler<E, R>(id: string, run: (event: HandlerEvent) => Effect<void, E, R>, opts?: HandlerOptions): Handler<E, R>

on(node: Node, events: Record<string, Handler<any, any>>): Node
bind<A>(atom: Atom<A>, key: string): Node

resume<R, LE>(opts: {
  container: Element
  layer: Layer<R, LE, never>
  handlers: Record<string, () => Promise<{ default: Handler<any, R> }>>
  atoms: Record<string, Atom<any>>
  onError?: (cause: Cause<unknown>) => void
}): Promise<{ dispose(): Promise<void> }>
```

- Tagged errors: `DuplicateHandler` (two different `Handler` values with one id in one render), `DuplicateBindKey`, `UnsupportedEvent`, `UnknownHandler`, `HandlerIdMismatch`, `ManifestInvalid` (missing, more than one, or malformed), `ManifestDecodeFailed` (names the atom key).
- `renderToString` rejects with the first three. `resume` rejects with `ManifestInvalid`, `ManifestDecodeFailed` or the original layer error (never a `FiberFailure`), and leaves the container untouched.
- Runtime errors never reject `resume` after it resolved: `UnknownHandler` (id not in `handlers`), `HandlerIdMismatch`, a rejected chunk import and a failing handler each call `onError`, drop that one run and keep later events working. A failed chunk load is not cached, so the next event retries it.
- `mount` renders `Bind` as its current value as static text and ignores `on`; it is otherwise unchanged.

## Edge Cases & Constraints
<!-- scope: technical -->

- Events before `resume()` runs are not replayed (Islands replays its first click; this spike does not). Recorded in the ADR as a known gap.
- A second `resume` on a container that is still resumed returns the first handle. After `dispose`, a new `resume` works.
- Two handlers written against one atom cannot race: runs are sequential.
- Nested elements with handlers for the same event: only the closest runs; `stopPropagation` is applied natively and synchronously.
- Text from atoms and attributes is escaped by the renderers exactly as today. Nothing in the manifest or `data-sleek-*` attributes is evaluated as code; handler ids are looked up in the `handlers` map only, never used as import paths.
- Server and client use the same provider nesting for the tree (a drift here is a known past bug class).
- Tests must not read the build-generated `.sleekstack` report.
- Client runtime budget is measured, not fixed: the spike reports the gzipped size of the `resume` entry (which must not contain React).

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `defineHandler`, `on` and `bind` exist; `renderToString` of a tree using them emits `data-sleek-on-<event>`, the static-flag attributes, `data-sleek-bind` and one escaped manifest script, and still rejects `on*` attributes. Errors: `DuplicateHandler`, `DuplicateBindKey` and `UnsupportedEvent` reject; a user `data-sleek-*` attribute is rejected; manifest content containing `</script>`, U+2028 or U+2029 stays inert.
- **R2:** `resume` over server-rendered HTML attaches handlers without calling any component function or `mount`. Errors: `ManifestInvalid` (missing, several, malformed) and `ManifestDecodeFailed` reject `resume` and leave the container untouched; a layer error rejects with the original error.
- **R3:** A handler loads lazily: its loader has not run before the first matching event and runs once across several events; runs execute in event order across ids through one queue. Errors: a rejected chunk import calls `onError`, is not cached, and the next event retries; `UnknownHandler` and `HandlerIdMismatch` call `onError` and drop that run; a dispose or second `resume` during a load drops the late run.
- **R4:** A handler runs as an Effect with the `resume` layer's services, writes an atom, and every bound text node of that atom updates; the handler receives a `HandlerEvent` snapshot (value and checked only from form controls), and the static `preventDefault` / `stopPropagation` flags apply synchronously before the chunk loads. Errors: a failing handler calls `onError` and leaves the DOM as it was; the closest handler only runs for nested elements.
- **R5:** Lifecycle: `dispose` removes listeners, interrupts forked fibers, disposes the store and drops pending runs; a second `resume` on one container returns the first handle; `resume` after `dispose` works. Errors: no error surface beyond R2 and R3.
- **R6:** The Analyzer's component pass roots a tree at `resume` and reports `NonResumableHandler` (inline function, non-literal id, handler not at top level or built in a loop, unreadable loader type) and `MissingDependency` for a handler whose `R` the `resume` layer does not provide, each with file:line, and passes a clean fixture. Errors: yields inside `Effect.all` and nested guest props are covered; an unreadable loader type fails closed.
- **R7:** `apps/ui-demo` has a counter component, server-rendered and then resumed in a jsdom test with a lazy handler chunk and a bound count; its existing Analyzer-clean test still passes.
- **R8:** ADR 0017 (Proposed) records the question, the design, the measured gzipped size of the `resume` entry (confirmed React-free), the known gaps (no replay of pre-resume events, guests not resumable, `mount` renders `Bind` statically), the divergence from fn-17's decode policy, and a yes/no answer with next steps. `CONTEXT.md` gains Handler, Resume and Manifest, each with an `_Avoid_` line, and lists `NonResumableHandler` with the other component-pass codes; the Analyzer README lists it too. Errors: no error surface beyond the measured number being reported.

## Quick commands
<!-- scope: technical -->

```bash
pnpm --filter @sleekstack/ui test
pnpm --filter @sleekstack/analyze test
pnpm --filter ui-demo test
```

## Early proof point

Task fn-18-resumable-rendering-spike-for.2 validates the core approach (a server-rendered tree resumes with zero component calls and a lazily loaded handler updates a bound atom). If it fails, re-evaluate the delegated-listener plus handler-id design before continuing with fn-18-resumable-rendering-spike-for.3 and later.

## Boundaries
<!-- scope: business -->

Out of scope: hydrating or resuming `fromReact` guests; replaying events that fire before `resume()` runs; an inline loader script and prefetch strategy; keyed list diffing or any update that is not an atom-bound text node; compiler-extracted handlers; non-bubbling events; per-handler Scopes; Next.js or RSC; serialization of anything except atom values; form `submit` payloads; the docs site API reference. Not changing ADR 0010: Islands remain the path for React components.

## Decision Context
<!-- scope: both -->

- **Explicit handler values with a map of lazy loaders** (chosen): handlers are named top-level Effects, as Islands are named in `defineIslands`. The Analyzer can check them and no compiler is needed.
- **Global handler registry** (rejected): duplicate-id errors at import time break HMR and tests that re-import a module. Duplicates are detected per render instead.
- **Qwik-style closure serialization** (rejected): needs a compiler that rewrites closures, and the Analyzer could no longer read requirements from the Effect types.
- **Re-run the tree on the client** (rejected): that is hydration, which resumability avoids.
- **One FIFO queue for all runs** (chosen over per-id queues): event order is the only ordering users can reason about, and it removes races on shared atoms.
- **Static flags emitted by the server** (chosen): a handler's options live in its unloaded chunk, so a client-only flag cannot run before the load.
- **Depends softly on fn-17** (atom dehydrate and seed): the spike uses fn-17's snapshot shape and its codec when it has landed, and hand-seeds JSON otherwise, so it is not blocked.
- **Open decision carried from ADR 0015**: whether ui sits beside kit or later replaces its React side. This spike's result informs it and does not settle it.


## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | `defineHandler`, `on` and `bind` exist; `renderToString` of a tree using them emits `data-sleek-on-<event>`, the static-flag attributes, `data-sleek-bind` and one escaped manifest script, and still rejects `on*` attributes. Errors: `DuplicateHandler`, `DuplicateBindKey` and `UnsupportedEvent` reject; a user `data-sleek-*` attribute is rejected; manifest content containing `</script>`, U+2028 or U+2029 stays inert. | fn-18-resumable-rendering-spike-for.1 | — |
| R2 | `resume` over server-rendered HTML attaches handlers without calling any component function or `mount`. Errors: `ManifestInvalid` (missing, several, malformed) and `ManifestDecodeFailed` reject `resume` and leave the container untouched; a layer error rejects with the original error. | fn-18-resumable-rendering-spike-for.2 | — |
| R3 | A handler loads lazily: its loader has not run before the first matching event and runs once across several events; runs execute in event order across ids through one queue. Errors: a rejected chunk import calls `onError`, is not cached, and the next event retries; `UnknownHandler` and `HandlerIdMismatch` call `onError` and drop that run; a dispose or second `resume` during a load drops the late run. | fn-18-resumable-rendering-spike-for.2 | — |
| R4 | A handler runs as an Effect with the `resume` layer's services, writes an atom, and every bound text node of that atom updates; the handler receives a `HandlerEvent` snapshot (value and checked only from form controls), and the static `preventDefault` / `stopPropagation` flags apply synchronously before the chunk loads. Errors: a failing handler calls `onError` and leaves the DOM as it was; the closest handler only runs for nested elements. | fn-18-resumable-rendering-spike-for.2 | — |
| R5 | Lifecycle: `dispose` removes listeners, interrupts forked fibers, disposes the store and drops pending runs; a second `resume` on one container returns the first handle; `resume` after `dispose` works. Errors: no error surface beyond R2 and R3. | fn-18-resumable-rendering-spike-for.2 | — |
| R6 | The Analyzer's component pass roots a tree at `resume` and reports `NonResumableHandler` (inline function, non-literal id, handler not at top level or built in a loop, unreadable loader type) and `MissingDependency` for a handler whose `R` the `resume` layer does not provide, each with file:line, and passes a clean fixture. Errors: yields inside `Effect.all` and nested guest props are covered; an unreadable loader type fails closed. | fn-18-resumable-rendering-spike-for.3 | — |
| R7 | `apps/ui-demo` has a counter component, server-rendered and then resumed in a jsdom test with a lazy handler chunk and a bound count; its existing Analyzer-clean test still passes. | fn-18-resumable-rendering-spike-for.4 | — |
| R8 | ADR 0017 (Proposed) records the question, the design, the measured gzipped size of the `resume` entry (confirmed React-free), the known gaps (no replay of pre-resume events, guests not resumable, `mount` renders `Bind` statically), the divergence from fn-17's decode policy, and a yes/no answer with next steps. `CONTEXT.md` gains Handler, Resume and Manifest, each with an `_Avoid_` line, and lists `NonResumableHandler` with the other component-pass codes; the Analyzer README lists it too. Errors: no error surface beyond the measured number being reported. | fn-18-resumable-rendering-spike-for.4, fn-18-resumable-rendering-spike-for.5 | — |

