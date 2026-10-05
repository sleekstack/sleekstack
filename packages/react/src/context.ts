/**
 * packages/react/src/context.ts
 *
 * Per-provider state shared with useService: the provider's component scope (as a
 * status-tracked promise, since building layers may be async) and a per-scope
 * service cache. Both live on one object so they share the provider's lifetime.
 */

import { createContext, createElement, useContext, type Provider, type ReactNode } from 'react'
import type { Cause } from 'effect'
import type { AtomStore, ChildScope } from '@sleekstack/core'
import type { Owned } from './managedScope'

/** Discriminated cache entry; `promise` identity is stable for the entry's lifetime (Suspense / `use`). */
export type CacheEntry =
  | { status: 'pending'; readonly promise: Promise<unknown> }
  | { status: 'resolved'; readonly promise: Promise<unknown>; value: unknown }
  | { status: 'rejected'; readonly promise: Promise<unknown>; error: unknown }

export type ScopeState =
  { status: 'pending' } | { status: 'resolved'; scope: ChildScope } | { status: 'rejected'; error: unknown }

export interface ProviderState {
  /** Resolves to this provider's component scope. Never rejects unhandled (see `scopeState`). */
  readonly scope: Promise<ChildScope>
  scopeState: ScopeState
  readonly cache: Map<unknown, CacheEntry>
  /** This provider's atom store, set once `scope` resolves; disposed when the component scope closes. */
  atoms: AtomStore | undefined
  readonly onFinalizerError: (cause: Cause.Cause<unknown>) => void
  /** Closers of nested providers; run (LIFO) before this provider's own scopes close. */
  readonly children: Set<() => Promise<void>>
  started: boolean
  /** Starts acquisition (and the parent's). Called on commit or when a consumer suspends on `scope`. */
  readonly start: () => void
}

export const ProviderContext = createContext<ProviderState | null>(null)

/** One server request's provider scopes, keyed by provider `useId`; `closers` in acquisition order. */
export interface RequestRegistry {
  readonly scopes: Map<string, Owned>
  readonly closers: Array<() => Promise<void>>
  closing?: Promise<void>
}

/** Set by `renderWithAtoms`; server providers under it acquire their scopes through it. */
export const RegistryContext = createContext<RequestRegistry | null>(null)

/**
 * The provider whose store holds queries: the root `LayerProvider`, or the nearest `QueryProvider` marker.
 * Nested providers inherit it, so they share one query store.
 */
export const QueryStoreContext = createContext<ProviderState | null>(null)

// Every `<ProviderContext.Provider>` also seeds QueryStoreContext when nothing above set it (i.e. at the root),
// so LayerProvider needs no query knowledge.
const BaseProvider = ProviderContext.Provider
const RootAwareProvider = ({ value, children }: { value: ProviderState | null; children?: ReactNode }) => {
  const query = useContext(QueryStoreContext)
  const inner = createElement(BaseProvider, { value }, children)
  return query ? inner : createElement(QueryStoreContext.Provider, { value }, inner)
}
;(ProviderContext as { Provider: Provider<ProviderState | null> }).Provider =
  RootAwareProvider as unknown as Provider<ProviderState | null>
