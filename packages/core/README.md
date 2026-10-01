# @sleekstack/core

The Effect-native engine. Core has no Effect-hiding sugar (that is [`@sleekstack/kit`](../kit)): everything it accepts is a plain Effect `Layer`. It has no runtime graph either; the dependency graph exists only at build time, in [`sleekstack check`](../cli).

| Export | What it is |
| --- | --- |
| `declareLayer(layer, { lifetime? })` | A Layer plus its lifetime (`app`, `request` or `component`). The Analyzer reads the provided and required Tags from the Layer's type. |
| `module({ name, entries, imports, exports, lifetime })` | A named group of entries. `exports` makes every other Tag private (checked at build time). `imports` may be a thunk. |
| `makeAppScope(entries, { onFinalizerError })` | Opens the app scope. `scope.child('request' \| 'component', entries?)` opens nested scopes; `scope.close` runs finalizers in reverse order. |
| `resolveTag`, `resolveTagEffect` | Look a Tag up in a scope's `context`; a miss is `MissingDependency`. |
| `Atom`, `Result`, `makeAtomStore` | Reactive client state modeled on effect-atom, no dependency. |
| Error classes | `MissingDependency`, `DependencyCycle`, `AmbiguousProvider`, `ModuleCycle`, `DuplicateModule`, `InvalidModule`, `CaptiveDependency`, `PrivateDependency`, `AtomCycle`. Only `MissingDependency` is raised by the runtime; `sleekstack check` reports the rest. |

```ts
import { Context, Effect, Layer } from 'effect'
import { declareLayer, makeAppScope, module } from '@sleekstack/core'

class Clock extends Context.Tag('Clock')<Clock, { now(): number }>() {}
class Greeter extends Context.Tag('Greeter')<Greeter, { greet(): string }>() {}

const ClockLive = declareLayer(Layer.succeed(Clock, { now: () => Date.now() }), {})
const GreeterLive = declareLayer(
  Layer.effect(Greeter, Effect.map(Clock, (c) => ({ greet: () => `hi at ${c.now()}` }))),
  { lifetime: 'request' },
)

// Entries build in position order: list a Layer after the Layers it needs.
const App = module({ name: 'app', entries: [ClockLive, GreeterLive] })
Effect.runPromise(makeAppScope([App]))
```

## Position order

The runtime builds entries deepest import first, then importers, then root entries. Each Layer builds over what was built before it, and a later (more local) Layer overrides an earlier one: that is Shadowing. A Layer that needs a Tag not built yet fails with `MissingDependency`. Kit sorts its `provide` lists by their `deps` arrays, so the ordering rule matters only for core Layers and kit generator Layers.

Guides and the generated API reference live in the docs site ([`apps/docs`](../../apps/docs/README.md)): run `pnpm --filter docs dev` and open http://localhost:3000/docs.
