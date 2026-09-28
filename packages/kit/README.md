# @sleekstack/kit

An Effect-free facade over `@sleekstack/core`, `@sleekstack/next` and `@sleekstack/react`. Services are plain
values, classes or (async) factories; dependencies are declared as an array of Tags. No Effect type is reachable
from any public entry.

| Subpath | Exports |
| --- | --- |
| `@sleekstack/kit` | `tag`, `layer`, `withCleanup`, `module`, `snapshot`, `SleekStackError` (+ types `Tag`, `Layer`, `Module`, `GraphSnapshot`, `FinalizerError`, ...) |
| `@sleekstack/kit/next` | `configureRuntime`, `action`, `query`, `fail` (+ `ActionResult`, `OperationOptions`, `RuntimeConfig`) |
| `@sleekstack/kit/react` | `LayerProvider`, `useService`, `useServices` |

Every failure is a `SleekStackError` with a `code` (`MissingDependency`, `DependencyCycle`, `CaptiveDependency`,
`AmbiguousProvider`, `ModuleCycle`, `DuplicateModule`, `InvalidModule`, `PrivateDependency`, `DuplicateTag`,
`InvalidTag`, `LayerFailed`, `CleanupFailed`, `HandlerFailed`, `Unknown`) and `details`.

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
