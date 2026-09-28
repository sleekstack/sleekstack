/**
 * packages/kit/src/effect.ts
 *
 * `effect()` runs a side effect when its scope opens; the function it returns
 * runs when the scope closes, like React's `useEffect`. Sugar over an anonymous
 * Layer: an internal `effect:<name>` Tag that nothing else depends on.
 */

import { layer, withCleanup, type Layer, type Lifetime, type Services } from './layer'
import { tag, type AnyTag } from './tag'

export interface EffectOptions {
  /** Shown in the graph snapshot and error messages as `effect:<name>`. */
  readonly name?: string
  readonly lifetime?: Lifetime
}

type Teardown = void | (() => void | Promise<void>)

let seq = 0

export function effect<const D extends readonly AnyTag[] = []>(
  fn: (...deps: Services<D>) => Teardown | Promise<Teardown>,
  deps?: D,
  opts: EffectOptions = {},
): Layer<void> {
  const key = `effect:${opts.name ?? ++seq}`
  return layer(
    tag<void>(key),
    async (...resolved: Services<D>) => {
      const teardown = await fn(...resolved)
      return typeof teardown === 'function' ? withCleanup(undefined, teardown) : undefined
    },
    deps,
    opts.lifetime ? { lifetime: opts.lifetime } : {},
  )
}
