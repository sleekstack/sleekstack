/**
 * packages/react/src/context.ts
 *
 * Per-provider state shared with useService: the provider's component scope (as a
 * status-tracked promise, since building layers may be async) and a per-scope
 * service cache. Both live on one object so they share the provider's lifetime.
 */

import { createContext } from 'react'
import type { Cause } from 'effect'
import type { ChildScope } from '@sleekstack/core'

/** Discriminated cache entry; `promise` identity is stable for the entry's lifetime (Suspense / `use`). */
export type CacheEntry =
  | { status: 'pending'; readonly promise: Promise<unknown> }
  | { status: 'resolved'; readonly promise: Promise<unknown>; value: unknown }
  | { status: 'rejected'; readonly promise: Promise<unknown>; error: unknown }

export type ScopeState =
  | { status: 'pending' }
  | { status: 'resolved'; scope: ChildScope }
  | { status: 'rejected'; error: unknown }

export interface ProviderState {
  /** Resolves to this provider's component scope. Never rejects unhandled (see `scopeState`). */
  readonly scope: Promise<ChildScope>
  scopeState: ScopeState
  readonly cache: Map<unknown, CacheEntry>
  readonly onFinalizerError: (cause: Cause.Cause<unknown>) => void
  /** Closers of nested providers; run (LIFO) before this provider's own scopes close. */
  readonly children: Set<() => Promise<void>>
  started: boolean
  /** Starts acquisition (and the parent's). Called on commit or when a consumer suspends on `scope`. */
  readonly start: () => void
}

export const ProviderContext = createContext<ProviderState | null>(null)
