/**
 * packages/react/src/context.ts
 *
 * React context for SleekStack's runtime-based provider.
 * Holds the ManagedRuntime + service cache co-located so both reset per mount.
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
 */
export type ProviderState = {
  runtime: ManagedRuntime.ManagedRuntime<any, never>
  cache: Map<any, CacheEntry>
}

/**
 * The React context through which useService reads the current provider's runtime + cache.
 * Default value is null (no ancestor LayerProvider present).
 */
export const ProviderContext = createContext<ProviderState | null>(null)
