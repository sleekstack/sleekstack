/**
 * packages/react/src/context.ts
 *
 * React context for SleekStack's runtime-based provider.
 * Holds the ManagedRuntime + service cache co-located so both reset per mount.
 *
 * ProviderState also exposes a `registerChildDispose` mechanism. Because
 * React 19 runs useEffect cleanups in parent-before-child order during unmount,
 * an inner LayerProvider registers its dispose with the parent. The outer
 * LayerProvider runs all registered child disposals (LIFO) before disposing
 * its own runtime, ensuring inner-before-outer finalization (REACT-02).
 */

import { createContext } from 'react'
import type { ManagedRuntime } from 'effect'

/**
 * A single cache entry for a resolved service.
 * One of: resolved (value), failed (error), or in-flight (promise).
 */
export type CacheEntry = {
  value?: unknown
  promise?: Promise<any>
  error?: any
}

/**
 * State held by each LayerProvider mount.
 * Both runtime and cache must live together so they reset atomically on unmount/remount
 * (Strict Mode double-invoke safety — see RESEARCH.md Pitfall 1).
 *
 * `registerChildDispose` is used by nested LayerProviders to ensure their runtime
 * is disposed before the outer runtime, despite React 19 running useEffect cleanups
 * in parent-before-child order.
 */
export type ProviderState = {
  runtime: ManagedRuntime.ManagedRuntime<any, never>
  cache: Map<any, CacheEntry>
  /**
   * Registers a dispose callback for a child LayerProvider's runtime.
   * The outer LayerProvider calls registered callbacks (LIFO) before its own dispose.
   *
   * Returns an unregister function — the child calls this inside its own useEffect
   * cleanup before it disposes, to avoid double-disposal.
   */
  registerChildDispose: (fn: () => void) => () => void
  /**
   * All child dispose callbacks registered by nested LayerProviders.
   * Managed internally by registerChildDispose; not used directly by consumers.
   */
  _childDisposals: (() => void)[]
}

/**
 * The React context through which useService reads the current provider's runtime + cache.
 * Default value is null (no ancestor LayerProvider present).
 */
export const ProviderContext = createContext<ProviderState | null>(null)
