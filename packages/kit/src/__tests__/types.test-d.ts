import { expectTypeOf } from 'vitest'
import { layer, tag, withCleanup } from '../index'

interface Cfg {
  url: string
}
const Cfg = tag<Cfg>('Cfg')
abstract class Clock {
  abstract now(): number
}
interface Svc {
  go(): string
}
const Svc = tag<Svc>('Svc')
type Transform = (n: number) => number
const Transform = tag<Transform>('Transform')

// deps infer the factory params, in order (tag and abstract class)
layer(
  Svc,
  (cfg, clock) => {
    expectTypeOf(cfg).toEqualTypeOf<Cfg>()
    expectTypeOf(clock).toEqualTypeOf<Clock>()
    return { go: () => cfg.url }
  },
  [Cfg, Clock],
)
layer(Svc, async () => withCleanup({ go: () => '' }, () => {}))

// @ts-expect-error wrong return type
layer(Svc, () => ({ go: () => 1 }))
// @ts-expect-error wrong plain value
layer(Cfg, { url: 1 })
// @ts-expect-error a callable plain value is not a value impl
layer(Transform, (n: number) => n + 1)
layer(Transform, () => (n: number) => n + 1)
