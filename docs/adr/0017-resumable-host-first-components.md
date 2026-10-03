# Resumable host-first components: handlers and bound text resume without re-running components

Status: Proposed (spike).

ADR 0010 rejected resumability because it cannot run arbitrary React components. ADR 0015 changed the premise: a `@sleekstack/ui` host tree is an Effect program, not React, so the question re-opens for host components only. The spike asked: can server-rendered host HTML become interactive without running any component on the client, at a bundle size worth having?

Answer: **yes, as a spike**. Bound text and handlers resume without calling a component. The shipped entry is dominated by Effect itself, so whether it is worth having depends on a page already paying for Effect.

## Design

- **Handler.** `defineHandler(id, run, opts?)` is a named Effect program `(event: HandlerEvent) => Effect<void, E, R>`, declared at module top level with a literal id. `on(node, { click: h })` attaches handlers to an element; only a fixed allow-list of bubbling events is accepted (`UnsupportedEvent` otherwise). The server emits only the handler id.
- **Bind.** `bind(atom, key)` renders the atom's current value as `<sleek-bind data-sleek-bind="key">value</sleek-bind>`. Handler ids and bind keys match `[A-Za-z0-9_.:/-]+`, and React guest output containing `data-sleek-` is rejected through `onError`.
- **Manifest.** `renderToString` appends one `<script data-sleek-manifest>` holding the delegated event types and a map from bind key to the atom's encoded value.
- **Resume.** `resume({ container, layer, handlers, atoms })` reads the manifest, seeds a store it owns, subscribes the bound text, and installs one delegated listener per event type. On the first event for a handler it loads the handler's chunk (`handlers[id]`), then runs every handler through one FIFO queue with `layer`. Handlers write atoms through the `Store` Tag, which `resume` provides, so the layer has type `Layer<Exclude<R, Store>, LE, never>`. `dispose` stops a running handler. A handler that throws synchronously does not stall the queue, and a cleanup error never replaces a layer error.
- **Analyzer.** `resume` is a tree root: one child per handler with the `R` of its loader's `default`, checked against the resume layer. `NonResumableHandler` reports an `on()` entry that is not a reference to a top-level `const h = defineHandler('literal', ...)` (or `export default defineHandler(...)`), and a handler map it cannot read.

## Divergence from ADR 0016's decode policy

`bind` and `resume` accept only serializable value-kind atoms (`Atom.serializable`). Any other atom throws the tagged `UnsupportedAtom` at `bind`, when a hand-built `Bind` node renders, and at `resume`; result-kind atoms are rejected too. The manifest maps a key to one encoded value, so a Result atom (a state machine, not a value) or a schema-less atom has nothing to encode. No core path for seeding a store without a schema was added.

`hydrate` (ADR 0016) drops a seed that fails to decode and recomputes the atom. `resume` instead fails with `ManifestDecodeFailed` and leaves the container untouched: the server HTML already shows the value, so silently recomputing would put the DOM and the store out of step.

## Measured size

Normal production build of `apps/ui-demo`'s resume entry, no overrides, after adding `"sideEffects": false` to `packages/ui/package.json` (no module has import-time side effects):

| Chunk | Minified | Gzip |
|-------|----------|------|
| Resume entry | 303,835 B | 78,633 B |
| Lazy handler chunk | 229 B | 183 B |
| Resume entry without `sideEffects: false` (React pulled in) | ~1,712,435 B | 434,466 B |

Almost all of the entry is Effect. The resume runtime itself is small, and a handler costs a few hundred bytes. Without `sideEffects: false` the bundler cannot drop the React guest path, and the entry is about five times larger.

## Considered options

- **Hydrate the host tree** (re-run components on the client): rejected. That is the cost resumability removes.
- **Serialize closures, Qwik-style**: rejected. A handler is a named module export loaded by id, so nothing captured has to be serialized and the Analyzer can check its requirements.
- **Named handlers, bound text and a manifest** *(chosen)*.

## Consequences and known gaps

- Events before `resume` finishes are not replayed (unlike Islands, ADR 0010).
- Guests are not resumable: their server DOM stays inert under `resume`. Making them interactive would need separate React hydration (for example Islands), which is out of scope.
- `mount` renders a `Bind` statically: it shows the value but does not subscribe it. Reactive components (ADR 0015) are not resumable and share no runtime path with `resume`.
- Only value-kind serializable atoms can be bound.

## Next steps

- Decide whether a page that already ships Effect should prefer `resume` over hydration, and measure it against a hydrated host tree.
- Replay pre-resume events, as Islands do.
- Decide whether `mount` should subscribe `Bind` nodes.
