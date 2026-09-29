/**
 * packages/kit/src/effect.ts
 *
 * `effect()` runs a side effect when its scope opens; the function it returns
 * runs when the scope closes, like React's `useEffect`. Sugar over an anonymous
 * Layer: an internal `effect:<name>` Tag that nothing else depends on.
 */

import { layer, withCleanup, type Layer, type Lifetime, type Services } from './layer'
import { tag, type AnyTag } from './tag'

/** Options for {@link effect}. */
export interface EffectOptions {
  /** Shown in the graph snapshot and error messages as `effect:<name>`. */
  readonly name?: string
  readonly lifetime?: Lifetime
}

type Teardown = void | (() => void | Promise<void>)

let seq = 0

/**
 * Runs a side effect when its scope opens; the function it returns runs when the scope closes,
 * like React's `useEffect`. List it in a module's `provide` like any Layer.
 *
 * @param fn - Receives `deps`' services in order; may return (or resolve to) a teardown. A teardown that throws or
 *   rejects is reported to `onFinalizerError` as a plain `FinalizerError` (`{ message, tag }`), not thrown.
 * @param deps - Tags resolved and passed to `fn`.
 * @param opts - `name` (shown as `effect:<name>`) and `lifetime`.
 * @returns A Layer nothing else depends on.
 * @throws {@link SleekStackError} with code `LayerFailed` (when the scope builds) when `fn` throws or rejects.
 *
 * @example
 * ```ts
 * import { effect, module, tag, layer } from '@sleekstack/kit'
 *
 * interface Logger { log(msg: string): void }
 * const Logger = tag<Logger>('Logger')
 *
 * const Heartbeat = effect((logger) => {
 *   const id = setInterval(() => logger.log('tick'), 1000)
 *   return () => clearInterval(id)
 * }, [Logger], { name: 'heartbeat' })
 *
 * export const App = module({ name: 'app', provide: [layer(Logger, { log: console.log }), Heartbeat] })
 * ```
 */
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
    deps ?? ([] as unknown as D),
    opts.lifetime ? { lifetime: opts.lifetime } : {},
  )
}
