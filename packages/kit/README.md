# @sleekstack/kit

An Effect-free facade over `@sleekstack/core`, `@sleekstack/next` and `@sleekstack/react`. Services are plain
values, classes or (async) factories; a layer declares its dependencies as an array of Tags or `yield*`s them from a generator; actions and queries `yield*` them. `sleekstack check` validates the graph at build time. No Effect type is reachable
from any public entry.

| Subpath | Exports |
| --- | --- |
| `@sleekstack/kit` | `tag`, `layer`, `withCleanup`, `effect`, `atom`, `module`, `SleekStackError` (+ types `Tag`, `Layer`, `Module`, `FinalizerError`, ...) |
| `@sleekstack/kit/next` | `configureRuntime`, `defineEffect`, `defineQuery`, `effect`, `query`, `fail` (+ `ActionResult`, `OperationOptions`, `RuntimeConfig`) |
| `@sleekstack/kit/react` | `LayerProvider`, `useService`, `useServices`, `useAtom`, `useAtomValue`, `useAtomSet` |

Every failure is a `SleekStackError` with a `code` (`MissingDependency`, `DependencyCycle`, `CaptiveDependency`,
`AmbiguousProvider`, `ModuleCycle`, `DuplicateModule`, `InvalidModule`, `PrivateDependency`, `DuplicateTag`,
`InvalidTag`, `LayerFailed`, `CleanupFailed`, `HandlerFailed`, `AtomCycle`, `Unknown`) and `details`.

## `@sleekstack/kit`

```ts
import { layer, module, tag, withCleanup } from '@sleekstack/kit'

const Clock = tag<{ now(): number }>('Clock')
const Db = tag<{ query(sql: string): unknown[] }>('Db')

const ClockLayer = layer(Clock, { now: () => Date.now() })                   // a value
const DbLayer = layer(Db, async (clock) => {                                // a factory, deps resolved in order
  const conn = await connect(clock.now())
  return withCleanup(conn, () => conn.close())
}, [Clock])

const Cache = tag<{ get(k: string): unknown }>('Cache')
const CacheLayer = layer(Cache, function* () {                              // a generator: yielded Tags are its deps
  const db = yield* Db
  return { get: (k: string) => db.query(`select ${k}`) }
})

export const App = module({ name: 'App', provide: [ClockLayer, DbLayer, CacheLayer], exports: [Db, Cache] })
// `sleekstack check` validates the graph at build time (nodes, edges, shadowing with `--json`)
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
- Graph rules (missing, captive, private) apply to its deps. It shows in the analyzer graph as `effect:<name>` (default `effect:<n>`).
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

- Readers suspend until the first value; failures reach the error boundary as `SleekStackError` (`MissingDependency`, `AtomCycle`, or `Unknown` for a throw/rejection in `fn`).
- `useAtomSet` accepts a value or an updater `(prev) => next`. Hooks are client only.

## `@sleekstack/kit/next`

```ts
import { configureRuntime, defineEffect, defineQuery, fail } from '@sleekstack/kit/next'

configureRuntime({ provide: [App] })                                        // once, from instrumentation.ts

const listRowsQuery = defineQuery(function* () { return (yield* Db).query('select 1') })
const addRowEffect = defineEffect(function* (title: string) {
  if (!title) fail('title required')                                        // -> { ok: false, error }
  return (yield* Db).query(`insert ${title}`)
})                                                                          // -> { ok: true, data }

// A 'use server' file exports literal async functions that call the definitions
// `{ provide: [Layers] }` shadows the graph for one call; `{ scope: [RequestContext] }` builds Tags the body never yields.
// (or run a generator inline with effect(gen) / query(gen)):
export async function listRows() { return listRowsQuery() }
export async function addRow(title: string) { return addRowEffect(title) }
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
[ADR 0011](../../docs/adr/0011-static-build-time-dependency-graph.md) for why deps are inferred and checked statically.
