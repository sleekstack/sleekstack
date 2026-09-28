/**
 * packages/react/src/LayerProvider.tsx
 *
 * LayerProvider owns a component scope from `@sleekstack/core`'s scope runtime.
 * A top-level provider (no parent provider) also creates and owns an app scope
 * for app-lifetime entries. A nested provider opens its component scope on the
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
import { Cause, Effect, Exit } from 'effect'
import { atomStoreFor, buildGraph, makeAppScope, type ChildScope, type Entry, type Module } from '@sleekstack/core'
import { ProviderContext, type ProviderState } from './context'

/** Props for {@link LayerProvider}. */
export interface LayerProviderProps {
  readonly provide: ReadonlyArray<Entry | Module>
  /** Sink for finalizer failures on unmount. Inherited by nested providers. Default `console.error`. */
  readonly onFinalizerError?: (cause: Cause.Cause<unknown>) => void
  readonly children?: React.ReactNode
}

const defaultSink = (cause: Cause.Cause<unknown>) => console.error(Cause.pretty(cause))

const sameEntries = (a: ReadonlyArray<unknown>, b: ReadonlyArray<unknown>) =>
  a === b || (a.length === b.length && a.every((x, i) => x === b[i]))

/** Structural equality of rendered children: element type, key and shallow props (children compared recursively). */
const sameNode = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => sameNode(x, b[i]))
  if (!React.isValidElement(a) || !React.isValidElement(b) || a.type !== b.type || a.key !== b.key) return false
  const pa = a.props as Record<string, unknown>
  const pb = b.props as Record<string, unknown>
  const ka = Object.keys(pa)
  return ka.length === Object.keys(pb).length && ka.every((k) => (k === 'children' ? sameNode(pa[k], pb[k]) : Object.is(pa[k], pb[k])))
}

interface Owned {
  readonly state: ProviderState
  readonly provide: ReadonlyArray<Entry | Module>
  readonly parent: ProviderState | null
  readonly close: () => Promise<void>
  committed: boolean
  parkToken?: object
  /** Props object of the render that last parked this scope. */
  parkedBy?: object
}

// A retry of a discarded render (Suspense, time slicing) re-renders the same element, so it reuses the props
// object; a sibling never does. Parked scopes are therefore adopted by props identity first. When an ancestor
// re-renders (a retry of a component that renders the provider), props are new but structurally equal: same
// parent, entries and children elements (type, key, shallow props), so the retry awaits the same scope.
// ponytail: siblings with identical entries and identical children share a parked scope; keys do not reach props.
const ADOPT_MS = 5000
const parked = new Set<Owned>()

/** Called synchronously by each render that created or adopted `owned`, so a retry (or StrictMode's second render) can adopt it. */
const park = (owned: Owned, props: object) => {
  parked.add(owned)
  owned.parkedBy = props
  const token = (owned.parkToken = {})
  const gc = (): unknown =>
    setTimeout(() => {
      if (owned.parkToken !== token || !parked.has(owned)) return
      if (owned.state.started && owned.state.scopeState.status === 'pending') return gc() // still acquiring
      parked.delete(owned)
      void owned.close()
    }, ADOPT_MS)
  gc()
}

const adopt = (props: LayerProviderProps, parent: ProviderState | null): Owned | undefined => {
  let found: Owned | undefined
  for (const o of parked) {
    if (o.parent !== parent) continue
    if (o.parkedBy === props) { found = o; break }
    if (!found && o.parkedBy && sameEntries(o.provide, props.provide) && sameNode((o.parkedBy as LayerProviderProps).children, props.children)) found = o
  }
  if (found) parked.delete(found)
  return found
}

function create(provide: ReadonlyArray<Entry | Module>, parent: ProviderState | null, sink: ProviderState['onFinalizerError']): Owned {
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
    : started.then(() => Effect.runPromise(Effect.suspend(() => makeAppScope(buildGraph([...provide]), { onFinalizerError: sink })))).then((app) => {
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
      for (const child of [...state.children].reverse()) await child()
      state.children.clear()
      for (const s of owned.reverse()) report(await Effect.runPromise(s.close))
    })())
  return { state, provide, parent, close, committed: false }
}

/**
 * Builds a scope for its subtree from `provide`: an app scope at the root, a component scope when
 * nested under another provider. The scope closes on unmount; StrictMode double mounts reuse it.
 * The scope builds asynchronously: graph errors (for example `MissingDependency`) and acquisition
 * failures are thrown by {@link useService} in the subtree, to its nearest error boundary.
 *
 * @param props - `provide` (modules/entries), optional `onFinalizerError`, and `children`.
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
  const pendingRef = useRef<{ cancelled: boolean } | null>(null)
  const initialProvide = useRef(provide)
  const warned = useRef(false)

  if (ownedRef.current === null) {
    ownedRef.current = adopt(props, parent) ?? create(provide, parent, onFinalizerError ?? parent?.onFinalizerError ?? defaultSink)
    park(ownedRef.current, props)
  }
  if ((globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV !== 'production' && !warned.current && !sameEntries(initialProvide.current, provide)) {
    warned.current = true
    console.warn('[@sleekstack/react] <LayerProvider provide> changed after mount; changes are ignored for the provider\'s lifetime. Remount it (e.g. with a key) to apply new entries.')
  }

  useEffect(() => {
    const owned = ownedRef.current!
    owned.committed = true
    parked.delete(owned)
    owned.state.start()
    // StrictMode remount before the deferred close ran: cancel it, keep the scope.
    if (pendingRef.current !== null) {
      pendingRef.current.cancelled = true
      pendingRef.current = null
    }
    parent?.children.add(owned.close)
    return () => {
      const token = { cancelled: false }
      pendingRef.current = token
      queueMicrotask(() => {
        if (token.cancelled) return
        // Stay registered until closed, so a closing parent awaits this close first.
        void owned.close().finally(() => parent?.children.delete(owned.close))
        if (ownedRef.current === owned) ownedRef.current = null
      })
    }
  }, [parent])

  return <ProviderContext.Provider value={ownedRef.current.state}>{children}</ProviderContext.Provider>
}
