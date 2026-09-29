/**
 * packages/react/src/LayerProvider.tsx
 *
 * LayerProvider owns a component scope from `@sleekstack/core`'s scope runtime.
 * A top-level provider (no parent provider) also creates and owns an app scope
 * for app-lifetime entries, unless given an externally owned `appScope`, which it
 * opens its component scope on and never closes. A nested provider opens its component scope on the
 * parent's, with its own `provide` entries shadowing the parent's inside it.
 *
 * Lifecycle (task .6 probe): deferred dispose. Effect cleanup schedules the close
 * on a microtask; StrictMode's synchronous remount cancels it and keeps the scope.
 * Closing runs nested providers first (LIFO), then the component scope, then the
 * app scope; finalizer failures go to `onFinalizerError` (default console.error).
 *
 * Acquisition starts on commit, or earlier when a consumer suspends on it (a
 * <Suspense> above the provider keeps it from committing). A render that never
 * commits loses its refs, so its scope is parked for React's retry to adopt, and
 * closed if no render adopts it within ADOPT_MS once settled.
 */

import React, { useContext, useEffect, useRef } from 'react'
import type { Cause } from 'effect'
import type { ChildScope, Entry, Module } from '@sleekstack/core'
import { ProviderContext } from './context'
import { acquire, mount, sameEntries, type Owned } from './managedScope'

/** Props for {@link LayerProvider}. */
export interface LayerProviderProps {
  readonly provide: ReadonlyArray<Entry | Module>
  /** Sink for finalizer failures on unmount. Inherited by nested providers. Default `console.error`. */
  readonly onFinalizerError?: (cause: Cause.Cause<unknown>) => void
  readonly children?: React.ReactNode
  /**
   * Externally owned app scope. A top-level provider opens its component scope (with `provide`) on it instead of
   * building its own app scope, and never closes it, so several React roots can share one app scope. The caller
   * closes it. Ignored by a nested provider.
   */
  readonly appScope?: ChildScope
  /**
   * @internal Identity used to re-adopt this provider's scope across discarded renders. A wrapper component passes
   * its own props object, which is stable across its retries; the default is these props.
   */
  readonly owner?: { readonly children?: React.ReactNode }
}

/**
 * Builds a scope for its subtree from `provide`: an app scope at the root, a component scope when
 * nested under another provider. With `appScope`, a root provider opens a component scope on that
 * external scope instead. Scopes it built close on unmount (an external `appScope` never does);
 * StrictMode double mounts reuse them.
 * The scope builds asynchronously: graph errors (for example `MissingDependency`) and acquisition
 * failures are thrown by {@link useService} in the subtree, to its nearest error boundary.
 *
 * @param props - `provide` (modules/entries), optional `onFinalizerError`, optional `appScope`, and `children`.
 * @returns The provider element.
 *
 * @example
 * ```tsx
 * import { module } from '@sleekstack/core'
 * import { LayerProvider } from '@sleekstack/react'
 *
 * const App = () => <LayerProvider provide={[module({ name: 'app' })]}>...</LayerProvider>
 * ```
 */
export function LayerProvider(props: LayerProviderProps) {
  const { provide, onFinalizerError, children } = props
  const parent = useContext(ProviderContext)
  const ownedRef = useRef<Owned | null>(null)
  const initialProvide = useRef(provide)
  const warned = useRef(false)

  if (ownedRef.current === null) {
    ownedRef.current = acquire(props, parent, onFinalizerError)
  }
  if ((globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV !== 'production' && !warned.current && !sameEntries(initialProvide.current, provide)) {
    warned.current = true
    console.warn('[@sleekstack/react] <LayerProvider provide> changed after mount; changes are ignored for the provider\'s lifetime. Remount it (e.g. with a key) to apply new entries.')
  }

  useEffect(() => {
    const owned = ownedRef.current!
    return mount(owned, parent, () => {
      if (ownedRef.current === owned) ownedRef.current = null
    })
  }, [parent])

  return <ProviderContext.Provider value={ownedRef.current.state}>{children}</ProviderContext.Provider>
}
