/**
 * packages/kit/src/react/hooks.ts
 *
 * Kit `LayerProvider`, `useService`, `useServices` over the react package.
 * Kit Tags map to core Tags; errors reach boundaries as SleekStackError.
 */

import { createContext, createElement, useContext, useMemo, useRef, type ReactNode } from 'react'
import { Effect, Exit } from 'effect'
import { declareLayer, makeAppScope, type ChildScope } from '@sleekstack/core'
import { QueryClientLive, QueryClientTag } from '@sleekstack/query'
import type { QueryClient } from '@tanstack/react-query'
import { closeProvidersOn, LayerProvider as CoreProvider, useService as coreUseService } from '@sleekstack/react'
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
  /** Externally owned app scope from {@link createAppScope}: shared across roots, never closed by the provider. */
  readonly appScope?: AppScopeHandle
}

declare const appScopeBrand: unique symbol
/** Opaque app scope from {@link createAppScope}. Close it when no provider uses it. */
export interface AppScopeHandle {
  readonly [appScopeBrand]: true
  /** Closes every provider still using the scope, then the scope; cleanup failures go to `onFinalizerError`. */
  readonly close: () => Promise<void>
}
const scopes = new WeakMap<AppScopeHandle, ChildScope>()

/**
 * Builds an app scope outside React from `provide`, for several `LayerProvider` roots to share via `appScope`.
 *
 * @param provide - App-lifetime layers and modules.
 * @param options - Optional `onFinalizerError` sink (default `console.error`).
 * @returns A promise of the opaque handle.
 * @throws {@link SleekStackError} (rejection) with `DuplicateTag`, `InvalidModule`, a graph code, or `LayerFailed`.
 *
 * @example
 * ```ts
 * import { module } from '@sleekstack/kit'
 * import { createAppScope } from '@sleekstack/kit/react'
 *
 * const AppModule = module({ name: 'app', provide: [] })
 * const app = await createAppScope([AppModule])
 * // <LayerProvider provide={[]} appScope={app}>...</LayerProvider> in each root
 * await app.close()
 * ```
 */
export async function createAppScope(
  provide: ReadonlyArray<Layer<any> | Module>,
  options: { readonly onFinalizerError?: (error: FinalizerError) => void } = {},
): Promise<AppScopeHandle> {
  const onError = options.onFinalizerError ?? ((e: FinalizerError) => console.error(e.message))
  const sink = (e: FinalizerError) => {
    try {
      onError(e)
    } catch (err) {
      console.error('[@sleekstack/kit] onFinalizerError threw:', err)
    }
  }
  try {
    validateProvide(provide)
    const scope = await Effect.runPromise(
      Effect.suspend(() => makeAppScope([...unwrap(provide)], { onFinalizerError: (c) => sink(toFinalizerError(c)) })),
    )
    const handle = {
      close: async () => {
        await closeProvidersOn(scope)
        const exit = await Effect.runPromise(scope.close)
        if (Exit.isFailure(exit)) sink(toFinalizerError(exit.cause))
      },
    } as AppScopeHandle
    scopes.set(handle, scope)
    return handle
  } catch (e) {
    throw normalize(e)
  }
}

/**
 * Builds a scope for its subtree from `provide`: the app scope at the root, a component scope when nested.
 * The scope closes on unmount. Keep `provide` referentially stable.
 *
 * @param props - `provide`, optional `onFinalizerError`, and `children`.
 * @returns The provider element.
 * @throws {@link SleekStackError} with `DuplicateTag` or `InvalidModule` during render when `provide` is invalid. Graph and
 *   build failures surface later, from {@link useService} in the subtree.
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
export function LayerProvider(props: LayerProviderProps): ReactNode {
  const { provide, onFinalizerError, children, appScope } = props
  const nested = useContext(KitProviderContext)
  // `nested` is fixed for a mounted position, so this hook call is stable. Suspends until the enclosing scope is built.
  const inherited = useContext(KitClientContext)
  const client = nested ? (inherited ?? kit(() => coreUseService(QueryClientTag))) : null
  // Memoized on the reference so core's sameEntries / StrictMode adopt see a stable array.
  // A root provider also builds the query client its subtree's kit queries share.
  const lowered = useMemo(() => {
    try {
      validateProvide(provide)
      const entries = unwrap(provide)
      return nested ? entries : [...entries, ROOT_QUERY_CLIENT]
    } catch (e) {
      throw normalize(e)
    }
  }, [provide, nested])
  const sink = useMemo(
    () => onFinalizerError && ((cause: unknown) => onFinalizerError(toFinalizerError(cause))),
    [onFinalizerError],
  )
  return createElement(CoreProvider, { provide: lowered, owner: props, ...(sink && { onFinalizerError: sink }), ...(appScope && { appScope: scopes.get(appScope) }) }, nested ? createElement(KitClientContext.Provider, { value: client }, children) : createElement(KitProviderContext.Provider, { value: true }, children))
}

/**
 * A root provider's shared query client. Component lifetime, so its layer is built in the root's component scope and
 * query bodies see component-lifetime Tags too; one value, so StrictMode's repeated memo runs yield equal entries.
 */
const ROOT_QUERY_CLIENT = declareLayer(QueryClientLive(), { lifetime: 'component' })

/** @internal True under a kit `LayerProvider` (so nested providers share the root's query client). */
export const KitProviderContext = createContext(false)

/**
 * @internal The query client a nested kit provider inherited from above. Its own component scope would build a new
 * component-lifetime client, so nested providers pass the enclosing one down through React context instead.
 */
export const KitClientContext = createContext<QueryClient | null>(null)


const isThenable = (x: unknown) => typeof (x as { then?: unknown } | null)?.then === 'function'

/** @internal Runs `f`, rethrowing suspensions as is and anything else as a {@link SleekStackError}. */
export const kit = <T>(f: () => T): T => {
  try {
    return f()
  } catch (e) {
    if (isThenable(e)) throw e
    throw normalize(e)
  }
}

/**
 * The Tag's service from the nearest LayerProvider. Suspends while building; wrap in `<Suspense>`.
 *
 * @param tag - The service's Tag.
 * @returns The service instance.
 * @throws {@link SleekStackError} with code `Unknown` when there is no `LayerProvider` above.
 * @throws {@link SleekStackError} with code `MissingDependency` when the Tag is not provided.
 * @throws {@link SleekStackError} with `LayerFailed` or a graph code (for example `MissingDependency`) when the provider's scope failed to build.
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
  return kit(() => coreUseService(coreTag(tag)) as T)
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
