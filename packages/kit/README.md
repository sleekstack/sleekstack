# @sleekstack/kit

An Effect-free facade over `@sleekstack/core`, `@sleekstack/next` and `@sleekstack/react`. Services are plain
values, classes or (async) factories; dependencies are declared as an array of Tags. No Effect type is reachable
from any public entry.

| Subpath | Exports |
| --- | --- |
| `@sleekstack/kit` | `tag`, `layer`, `withCleanup`, `effect`, `atom`, `module`, `snapshot`, `SleekStackError` (+ types `Tag`, `Layer`, `Module`, `GraphSnapshot`, `FinalizerError`, ...) |
| `@sleekstack/kit/next` | `configureRuntime`, `action`, `query`, `fail` (+ `ActionResult`, `OperationOptions`, `RuntimeConfig`) |
| `@sleekstack/kit/react` | `LayerProvider`, `useService`, `useServices`, `useAtom`, `useAtomValue`, `useAtomSet` |

Every failure is a `SleekStackError` with a `code` (`MissingDependency`, `DependencyCycle`, `CaptiveDependency`,
`AmbiguousProvider`, `ModuleCycle`, `DuplicateModule`, `InvalidModule`, `PrivateDependency`, `DuplicateTag`,
`InvalidTag`, `LayerFailed`, `CleanupFailed`, `HandlerFailed`, `AtomCycle`, `Unknown`) and `details`.

## `@sleekstack/kit`

```ts
import { layer, module, snapshot, tag, withCleanup } from '@sleekstack/kit'

const Clock = tag<{ now(): number }>('Clock')
const Db = tag<{ query(sql: string): unknown[] }>('Db')

const ClockLayer = layer(Clock, { now: () => Date.now() })                   // a value
const DbLayer = layer(Db, async (clock) => {                                // a factory, deps resolved in order
  const conn = await connect(clock.now())
  return withCleanup(conn, () => conn.close())
}, [Clock])

export const App = module({ name: 'App', provide: [ClockLayer, DbLayer], exports: [Db] })
snapshot(App) // core's GraphSnapshot: nodes, edges, shadowing
```

### Side effects: `effect()`

A job, subscription or warm-up with no service to expose. `fn(...deps)` runs when its scope opens; the function it returns runs when the scope closes, like `useEffect`. Put it in any provide set.

```ts
import { effect } from '@sleekstack/kit'

const refresh = effect((db, clock) => {
  const t = setInterval(() => db.query(`-- refresh at ${clock.now()}`), 60_000)
  return () => clearInterval(t)
}, [Db, Clock], { name: 'refresh', lifetime: 'app' })

export const App = module({ name: 'App', provide: [ClockLayer, DbLayer, refresh] })
```

- Setup may be async. A throw is `SleekStackError` `LayerFailed` with `details.tag` `effect:refresh`; a cleanup throw reaches `onFinalizerError` with `tag: 'effect:refresh'`.
- Graph rules (missing, captive, private) apply to its deps. It shows in `snapshot()` as `effect:<name>` (default `effect:<n>`).
- It runs once per scope; it doesn't re-run when deps change.

### Atoms: `atom()`

Client-side reactive state, held per `LayerProvider`. `atom(value)` is writable state. `atom(fn, deps)` is derived: the services of `deps` are resolved like `layer`, then `fn(...services, get)` returns a value or a Promise; `get(other)` reads another atom and recomputes on change.

```tsx
import { atom } from '@sleekstack/kit'
import { useAtom, useAtomValue } from '@sleekstack/kit/react'

const userId = atom(1)
const userName = atom((db, get) => db.query(`select name from users where id = ${get(userId)}`), [Db])
const byId = atom.family((id: number, db) => db.query(`select * from users where id = ${id}`), [Db])

const Name = () => <span>{String(useAtomValue(userName))}</span>             // suspends on first load
const Next = () => { const [id, set] = useAtom(userId); return <button onClick={() => set(id + 1)}>next</button> }
```

- Readers suspend until the first value; failures reach the error boundary as `SleekStackError` (`MissingDependency`, `PrivateDependency`, `AtomCycle`, or `Unknown` for a throw/rejection in `fn`).
- `useAtomSet` accepts a value or an updater `(prev) => next`. Hooks are client only.

## `@sleekstack/kit/next`

```ts
import { action, configureRuntime, fail, query } from '@sleekstack/kit/next'

configureRuntime({ provide: [App] })                                        // once, from instrumentation.ts

export const listRows = query((db) => () => db.query('select 1'), [Db])
export const addRow = action((db) => async (title: string) => {
  if (!title) fail('title required')                                        // -> { ok: false, error }
  return db.query(`insert ${title}`)
}, [Db])                                                                    // -> { ok: true, data }
```

## `@sleekstack/kit/react`

```tsx
import { LayerProvider, useService } from '@sleekstack/kit/react'

function Now() {
  return <span>{useService(Clock).now()}</span>                              // suspends until built
}

<LayerProvider provide={[ClockLayer]}><Now /></LayerProvider>
```

See [`apps/showcase-kit`](../../apps/showcase-kit/README.md) for the full task board, and
[ADR 0005](../../docs/adr/0005-dependency-arrays-over-inject.md) for why dependencies are arrays.
