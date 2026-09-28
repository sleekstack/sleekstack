/**
 * packages/kit/src/react/hooks.ts
 *
 * Kit `LayerProvider`, `useService`, `useServices` over the react package.
 * Kit Tags map to core Tags; errors reach boundaries as SleekStackError.
 */

import { createElement, useMemo, useRef, type ReactNode } from 'react'
import { Runtime } from 'effect'
import { LayerProvider as CoreProvider, useService as coreUseService } from '@sleekstack/react'
import { normalize, toFinalizerError, type FinalizerError } from '../errors'
import type { Layer, Services } from '../layer'
import { unwrap, validateProvide, type Module } from '../module'
import { coreTag, type AnyTag, type TagLike } from '../tag'

/** Props for {@link LayerProvider}. */
export interface LayerProviderProps {
  readonly provide: ReadonlyArray<Layer<any> | Module>
  /** Sink for cleanup failures on unmount. Default `console.error`. */
  readonly onFinalizerError?: (error: FinalizerError) => void
  readonly children?: ReactNode
}

const toKit = (e: unknown) => normalize(Runtime.isFiberFailure(e) ? e[Runtime.FiberFailureCauseId] : e)

/**
 * Builds a scope for its subtree from `provide`: the app scope at the root, a component scope when nested.
 * The scope closes on unmount. Keep `provide` referentially stable.
 *
 * @param props - `provide`, optional `onFinalizerError`, and `children`.
 * @returns The provider element.
 * @throws {@link SleekStackError} (to the nearest error boundary) with `DuplicateTag`, `InvalidModule`, or a graph code when `provide` is invalid.
 *
 * @example
 * ```tsx
 * import { layer, module, tag } from '@sleekstack/kit'
 * import { LayerProvider } from '@sleekstack/kit/react'
 *
 * interface Clock { now(): number }
 * const Clock = tag<Clock>('Clock')
 * const provide = [module({ name: 'app', provide: [layer(Clock, { now: () => Date.now() })] })]
 *
 * export const App = () => <LayerProvider provide={provide}><main /></LayerProvider>
 * ```
 */
export function LayerProvider({ provide, onFinalizerError, children }: LayerProviderProps): ReactNode {
  // Memoized on the reference so core's sameEntries / StrictMode adopt see a stable array.
  const lowered = useMemo(() => {
    try {
      validateProvide(provide)
      return unwrap(provide)
    } catch (e) {
      throw toKit(e)
    }
  }, [provide])
  const sink = useMemo(
    () => onFinalizerError && ((cause: unknown) => onFinalizerError(toFinalizerError(Runtime.isFiberFailure(cause) ? cause[Runtime.FiberFailureCauseId] : cause))),
    [onFinalizerError],
  )
  return createElement(CoreProvider, { provide: lowered, ...(sink && { onFinalizerError: sink }) }, children)
}

const isThenable = (x: unknown) => typeof (x as { then?: unknown } | null)?.then === 'function'

/**
 * The Tag's service from the nearest LayerProvider. Suspends while building; wrap in `<Suspense>`.
 *
 * @param tag - The service's Tag.
 * @returns The service instance.
 * @throws {@link SleekStackError} with code `MissingDependency` or `PrivateDependency` when the Tag is not visible here.
 * @throws {@link SleekStackError} with code `LayerFailed` when the scope failed to build.
 *
 * @example
 * ```tsx
 * import { tag } from '@sleekstack/kit'
 * import { useService } from '@sleekstack/kit/react'
 *
 * interface Clock { now(): number }
 * const Clock = tag<Clock>('Clock')
 *
 * export const Now = () => <time>{useService(Clock).now()}</time>
 * ```
 */
export function useService<T>(tag: TagLike<T>): T {
  try {
    return coreUseService(coreTag(tag)) as T
  } catch (e) {
    if (isThenable(e)) throw e
    throw toKit(e)
  }
}

const isDev = () => (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV !== 'production'

/**
 * {@link useService} for each Tag, in order. Keep the array length fixed.
 *
 * @param tags - The Tags to read.
 * @returns Their services, in order.
 * @throws {@link SleekStackError} with the same codes as {@link useService}.
 *
 * @example
 * ```tsx
 * import { tag } from '@sleekstack/kit'
 * import { useServices } from '@sleekstack/kit/react'
 *
 * interface Clock { now(): number }
 * interface Greeter { greet(): string }
 * const Clock = tag<Clock>('Clock')
 * const Greeter = tag<Greeter>('Greeter')
 *
 * export const Hello = () => {
 *   const [clock, greeter] = useServices([Clock, Greeter])
 *   return <p>{greeter.greet()} at {clock.now()}</p>
 * }
 * ```
 */
export function useServices<const D extends readonly AnyTag[]>(tags: D): Services<D> {
  const len = useRef(tags.length)
  if (isDev() && len.current !== tags.length) {
    console.warn(`[@sleekstack/kit] useServices: tag array length changed (${len.current} -> ${tags.length}); keep it fixed between renders.`)
    len.current = tags.length
  }
  return tags.map((t) => useService(t)) as Services<D>
}
