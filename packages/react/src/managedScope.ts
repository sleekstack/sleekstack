/**
 * packages/react/src/managedScope.ts
 *
 * Internal scope lifecycle behind LayerProvider: create a provider's scopes, park them for a discarded
 * render's retry to adopt, close parked scopes nobody adopts within ADOPT_MS, and close in order
 * (nested providers, then atoms and services of the component scope, then the app scope).
 */

import React from 'react'
import { Cause, Effect, Exit } from 'effect'
import { atomStoreFor, makeAppScope, makeAtomStore, type ChildScope, type Entry, type Module } from '@sleekstack/core'
import { RegistryContext, type ProviderState, type RequestRegistry } from './context'
import { settleSuspensions } from './atoms'

/** The props adoption reads: entries, children shape, and the optional `owner` identity. */
export interface ScopeProps {
  readonly provide: ReadonlyArray<Entry | Module>
  readonly children?: React.ReactNode
  readonly owner?: { readonly children?: React.ReactNode }
  /** Externally owned app scope a top-level provider opens its component scope on; never closed by the provider. */
  readonly appScope?: ChildScope
}

declare const process: { readonly env: { readonly NODE_ENV?: string } }
// Dev-only rendezvous list read by `@sleekstack/react/internal` (registry.ts); the literal key is
// duplicated there so the main barrel imports no registry code. Bundlers fold the guard away in production.
const devStores = (): Set<unknown> | undefined =>
  typeof process !== 'undefined' && process.env.NODE_ENV !== 'production'
    ? (((globalThis as Record<string, unknown>).__sleekstack_atom_stores__ as Set<unknown> | undefined) ??= new Set())
    : undefined

const defaultSink = (cause: Cause.Cause<unknown>) => console.error(Cause.pretty(cause))

export const sameEntries = (a: ReadonlyArray<unknown>, b: ReadonlyArray<unknown>) =>
  a === b || (a.length === b.length && a.every((x, i) => x === b[i]))

/**
 * Children equal up to re-creation: same element types and keys, equal primitive props. Functions and objects
 * are skipped, since an ancestor's re-render makes new ones (inline callbacks, style objects).
 */
const sameShape = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => sameShape(x, b[i]))
  if (!React.isValidElement(a) || !React.isValidElement(b) || a.type !== b.type || a.key !== b.key) return false
  const pa = a.props as Record<string, unknown>
  const pb = b.props as Record<string, unknown>
  const keys = new Set([...Object.keys(pa), ...Object.keys(pb)])
  return [...keys].every((k) => {
    const x = pa[k]
    const y = pb[k]
    if (k === 'children') return sameShape(x, y)
    const opaque = (v: unknown) => typeof v === 'function' || (typeof v === 'object' && v !== null)
    return opaque(x) && opaque(y) ? true : Object.is(x, y)
  })
}

export interface Owned {
  readonly state: ProviderState
  readonly provide: ReadonlyArray<Entry | Module>
  readonly parent: ProviderState | null
  readonly appScope?: ChildScope
  readonly close: () => Promise<void>
  committed: boolean
  /** Deferred close scheduled by the last unmount; a StrictMode remount cancels it. */
  pendingClose?: { cancelled: boolean }
  parkToken?: object
  /** Props object of the render that last parked this scope. */
  parkedBy?: object
  /** Parked by an earlier render pass (set on the microtask after parking); adoptable by an ancestor's retry. */
  stale?: boolean
}

// A retry of a discarded render (Suspense, time slicing) re-renders the same element, so it reuses the props
// object; a sibling never does. Parked scopes are therefore adopted by props identity first. When an ancestor
// re-renders (a retry of a component that renders the provider), props are new: the oldest parked scope with the
// same parent, entries and children shape (sameShape) parked by an earlier task is adopted, so the retry awaits
// it. Parked scopes turn adoptable only after their task, so siblings rendered together never share; across
// passes, park order (render order) pairs each sibling with its own earlier scope.
// ponytail: React exposes no identity for an uncommitted instance, so siblings with identical entries and
// children shape rendered in different slices of one time-sliced pass can share; keys do not reach props.
export const ADOPT_MS = 5000
const parked = new Set<Owned>()

/** Called synchronously by each render that created or adopted `owned`, so a retry (or StrictMode's second render) can adopt it. */
const park = (owned: Owned, props: object) => {
  parked.add(owned)
  const token = (owned.parkToken = {})
  owned.parkedBy = props
  owned.stale = false
  queueMicrotask(() => { if (owned.parkToken === token) owned.stale = true })
  const gc = (): unknown =>
    setTimeout(() => {
      if (owned.parkToken !== token || !parked.has(owned)) return
      if (owned.state.started && owned.state.scopeState.status === 'pending') return gc() // still acquiring
      parked.delete(owned)
      void owned.close()
    }, ADOPT_MS)
  gc()
}

const adopt = (props: ScopeProps, parent: ProviderState | null, appScope: ChildScope | undefined): Owned | undefined => {
  let found: Owned | undefined
  for (const o of parked) {
    if (o.parent !== parent || o.appScope !== appScope) continue
    if (o.parkedBy === (props.owner ?? props)) { found = o; break }
    if (!found && o.stale && sameEntries(o.provide, props.provide) && sameShape((o.parkedBy as ScopeProps).children, props.children)) found = o
  }
  if (found) parked.delete(found)
  return found
}

function create(provide: ReadonlyArray<Entry | Module>, parent: ProviderState | null, sink: ProviderState['onFinalizerError'], appScope?: ChildScope): Owned {
  const report = (exit: Exit.Exit<void, unknown>) => {
    if (Exit.isSuccess(exit)) return
    try {
      sink(exit.cause)
    } catch (e) {
      console.error('[@sleekstack/react] onFinalizerError threw:', e)
    }
  }
  const owned: ChildScope[] = [] // app (top-level only), then component; closed in reverse

  let resolveStart!: () => void
  const started = new Promise<void>((r) => (resolveStart = r))
  const opened: Promise<ChildScope> = parent
    ? started.then(() => parent.scope).then((p) => Effect.runPromise(p.child('component', [...provide])))
    : appScope
    ? started.then(() => Effect.runPromise(appScope.child('component', [...provide])))
    : started.then(() => Effect.runPromise(Effect.suspend(() => makeAppScope([...provide], { onFinalizerError: sink })))).then((app) => {
        owned.push(app)
        return Effect.runPromise(app.child('component'))
      })
  const scope = opened.then((s) => {
    owned.push(s)
    // Registered on the scope after its services, so closing it interrupts atoms before service finalizers.
    state.atoms = atomStoreFor(s, {
      defaultIdleTTL: 400,
      onFinalizerError: (e) => report(Exit.failCause(Cause.isCause(e) ? e : Cause.die(e))),
    })
    devStores()?.add(state.atoms)
    return s
  })

  const start = () => {
    if (state.started) return
    state.started = true
    parent?.start()
    resolveStart()
  }
  const state: ProviderState = { scope, scopeState: { status: 'pending' }, cache: new Map(), atoms: undefined, onFinalizerError: sink, children: new Set(), started: false, start }
  scope.then(
    (s) => void (state.scopeState = { status: 'resolved', scope: s }),
    (error) => void (state.scopeState = { status: 'rejected', error }),
  )

  let closing: Promise<void> | undefined
  const close = () =>
    (closing ??= (async () => {
      if (!state.started) return
      await scope.catch(() => undefined)
      if (state.atoms) devStores()?.delete(state.atoms)
      for (const child of [...state.children].reverse()) await child()
      state.children.clear()
      for (const s of owned.reverse()) report(await Effect.runPromise(s.close))
      if (state.atoms) settleSuspensions(state.atoms)
    })())
  return { state, provide, parent, appScope, close, committed: false }
}

/** Closers of committed providers opened on each external app scope. */
const external = new WeakMap<ChildScope, Set<() => Promise<void>>>()

/**
 * Closes every provider opened on `appScope` (LIFO, including closes already scheduled by unmounts) so an external
 * owner can close `appScope` after its component scopes.
 */
export const closeProvidersOn = async (appScope: ChildScope): Promise<void> => {
  await Promise.resolve() // let unmount-scheduled closes (queued microtasks) start first
  for (const close of [...(external.get(appScope) ?? [])].reverse()) await close()
}

/** Adopts a parked scope for this render or creates one, then parks it under this render's identity. */
export const acquire = (props: ScopeProps, parent: ProviderState | null, sink: ProviderState['onFinalizerError'] | undefined): Owned => {
  const appScope = parent ? undefined : props.appScope // ignored when nested
  const owned = adopt(props, parent, appScope) ?? create(props.provide, parent, sink ?? parent?.onFinalizerError ?? defaultSink, appScope)
  park(owned, props.owner ?? props)
  return owned
}

/**
 * Commit (the provider's effect): unpark, start acquiring, register with the parent. The returned cleanup
 * closes on a microtask, so StrictMode's synchronous remount cancels it and keeps the scope; `onClosed`
 * runs when the close is scheduled.
 */
export const mount = (owned: Owned, parent: ProviderState | null, onClosed: () => void) => {
  owned.committed = true
  parked.delete(owned)
  owned.state.start()
  if (owned.pendingClose) {
    owned.pendingClose.cancelled = true
    owned.pendingClose = undefined
  }
  parent?.children.add(owned.close)
  const siblings = owned.appScope && (external.get(owned.appScope) ?? external.set(owned.appScope, new Set()).get(owned.appScope)!)
  siblings?.add(owned.close)
  return () => {
    const token = (owned.pendingClose = { cancelled: false })
    queueMicrotask(() => {
      if (token.cancelled) return
      // Stay registered until closed, so a closing parent awaits this close first.
      void owned.close().finally(() => {
        parent?.children.delete(owned.close)
        siblings?.delete(owned.close)
      })
      onClosed()
    })
  }
}

const sinkFor = (sink: ProviderState['onFinalizerError'] | undefined, parent: ProviderState | null) => sink ?? parent?.onFinalizerError ?? defaultSink

/**
 * Server acquisition under a request registry: the scope registered under `id` (a Suspense retry of the same
 * provider), else a new one started at once (no commit on the server) and closed by {@link closeRegistry}.
 */
export const acquireOnServer = (registry: RequestRegistry, id: string, props: ScopeProps, parent: ProviderState | null, sink: ProviderState['onFinalizerError'] | undefined): Owned => {
  const found = registry.scopes.get(id)
  if (found) return found
  const owned = create(props.provide, parent, sinkFor(sink, parent), parent ? undefined : props.appScope)
  owned.state.start()
  registry.scopes.set(id, owned)
  registry.closers.push(owned.close)
  return owned
}

/** Closes every scope `registry` handed out, newest first (children before parents); idempotent. */
export const closeRegistry = (registry: RequestRegistry): Promise<void> =>
  (registry.closing ??= (async () => {
    for (const close of [...registry.closers].reverse()) await close()
  })())

/**
 * Server render without a registry: services keep the client acquisition; atoms read from an inert per-render
 * store (no fiber forked), shadowing the `atoms` the live state would set once its scope opens.
 */
const inertServerState = (props: ScopeProps, parent: ProviderState | null, sink: ProviderState['onFinalizerError'] | undefined): Owned => {
  const owned = acquire(props, parent, sink)
  const state: ProviderState = Object.create(owned.state, { atoms: { value: makeAtomStore({ inert: true }) } })
  return { ...owned, state }
}

/** The provider's scope source: request registry (server under `renderWithAtoms`), inert server state, or client `acquire`. */
export const useScopeSource = (props: ScopeProps, parent: ProviderState | null, sink: ProviderState['onFinalizerError'] | undefined): React.RefObject<Owned | null> => {
  const id = React.useId()
  const registry = React.useContext(RegistryContext)
  const ref = React.useRef<Owned | null>(null)
  if (ref.current === null) {
    ref.current =
      registry ? acquireOnServer(registry, id, props, parent, sink)
      : typeof window === 'undefined' ? inertServerState(props, parent, sink)
      : acquire(props, parent, sink)
  }
  return ref
}
