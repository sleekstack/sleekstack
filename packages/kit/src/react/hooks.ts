/**
 * packages/kit/src/react/hooks.ts
 *
 * Kit `LayerProvider`, `useService`, `useServices` over the react package.
 * Kit Tags map to core Tags; errors reach boundaries as SleekStackError.
 */

import { createElement, useMemo, useRef, type ReactNode } from 'react'
import { Runtime } from 'effect'
import { LayerProvider as CoreProvider, useService as coreUseService } from '@sleekstack/react'
import { normalize, type FinalizerError } from '../errors'
import type { Layer, Services } from '../layer'
import { unwrap, validateProvide, type Module } from '../module'
import { coreTag, type AnyTag, type TagLike } from '../tag'

export interface LayerProviderProps {
  readonly provide: ReadonlyArray<Layer<any> | Module>
  /** Sink for cleanup failures on unmount. Default `console.error`. */
  readonly onFinalizerError?: (error: FinalizerError) => void
  readonly children?: ReactNode
}

const toKit = (e: unknown) => normalize(Runtime.isFiberFailure(e) ? e[Runtime.FiberFailureCauseId] : e)

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
    () => onFinalizerError && ((cause: unknown) => onFinalizerError({ message: toKit(cause).message })),
    [onFinalizerError],
  )
  return createElement(CoreProvider, { provide: lowered, ...(sink && { onFinalizerError: sink }) }, children)
}

const isThenable = (x: unknown) => typeof (x as { then?: unknown } | null)?.then === 'function'

/** The Tag's service from the nearest LayerProvider. Suspends while building; wrap in `<Suspense>`. */
export function useService<T>(tag: TagLike<T>): T {
  try {
    return coreUseService(coreTag(tag)) as T
  } catch (e) {
    if (isThenable(e)) throw e
    throw toKit(e)
  }
}

const isDev = () => (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV !== 'production'

/** `useService` for each Tag, in order. Keep the array length fixed. */
export function useServices<const D extends readonly AnyTag[]>(tags: D): Services<D> {
  const len = useRef(tags.length)
  if (isDev() && len.current !== tags.length) {
    console.warn(`[@sleekstack/kit] useServices: tag array length changed (${len.current} -> ${tags.length}); keep it fixed between renders.`)
    len.current = tags.length
  }
  return tags.map((t) => useService(t)) as Services<D>
}
