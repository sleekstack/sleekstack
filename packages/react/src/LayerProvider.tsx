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
 */

import React, { useContext, useEffect, useRef } from 'react'
import { Cause, Effect, Exit } from 'effect'
import { buildGraph, makeAppScope, type ChildScope, type Entry, type Module } from '@sleekstack/core'
import { ProviderContext, type ProviderState } from './context'

export interface LayerProviderProps {
  readonly provide: ReadonlyArray<Entry | Module>
  /** Sink for finalizer failures on unmount. Inherited by nested providers. Default `console.error`. */
  readonly onFinalizerError?: (cause: Cause.Cause<unknown>) => void
  readonly children?: React.ReactNode
}

const defaultSink = (cause: Cause.Cause<unknown>) => console.error(Cause.pretty(cause))

const isModule = (e: Entry | Module): e is Module => (e as { _tag?: unknown })._tag === 'Module'

// ponytail: nested boundaries take module entries flat (imports not walked); walk them if nested modules need imports.
const boundaryEntries = (provide: ReadonlyArray<Entry | Module>): Entry[] =>
  provide.flatMap((e) => (isModule(e) ? [...e.entries] : [e]))

const sameEntries = (a: ReadonlyArray<unknown>, b: ReadonlyArray<unknown>) =>
  a === b || (a.length === b.length && a.every((x, i) => x === b[i]))

interface Owned {
  readonly state: ProviderState
  /** Starts acquisition. Called from the commit effect, so an abandoned render acquires nothing. */
  readonly start: () => void
  readonly close: () => Promise<void>
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

  let start!: () => void
  const started = new Promise<void>((r) => (start = r))
  const opened: Promise<ChildScope> = parent
    ? started.then(() => parent.scope).then((p) => Effect.runPromise(p.child('component', boundaryEntries(provide))))
    : started.then(() => Effect.runPromise(Effect.suspend(() => makeAppScope(buildGraph([...provide]), { onFinalizerError: sink })))).then((app) => {
        owned.push(app)
        return Effect.runPromise(app.child('component'))
      })
  const scope = opened.then((s) => {
    owned.push(s)
    return s
  })

  const state: ProviderState = { scope, scopeState: { status: 'pending' }, cache: new Map(), onFinalizerError: sink, children: new Set() }
  scope.then(
    (s) => void (state.scopeState = { status: 'resolved', scope: s }),
    (error) => void (state.scopeState = { status: 'rejected', error }),
  )

  let closing: Promise<void> | undefined
  const close = () =>
    (closing ??= (async () => {
      await scope.catch(() => undefined)
      for (const child of [...state.children].reverse()) await child()
      state.children.clear()
      for (const s of owned.reverse()) report(await Effect.runPromise(s.close))
    })())
  return { state, start, close }
}

export function LayerProvider({ provide, onFinalizerError, children }: LayerProviderProps) {
  const parent = useContext(ProviderContext)
  const ownedRef = useRef<Owned | null>(null)
  const pendingRef = useRef<{ cancelled: boolean } | null>(null)
  const initialProvide = useRef(provide)
  const warned = useRef(false)

  if (ownedRef.current === null) {
    ownedRef.current = create(provide, parent, onFinalizerError ?? parent?.onFinalizerError ?? defaultSink)
  }
  if ((globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV !== 'production' && !warned.current && !sameEntries(initialProvide.current, provide)) {
    warned.current = true
    console.warn('[@sleekstack/react] <LayerProvider provide> changed after mount; changes are ignored for the provider\'s lifetime. Remount it (e.g. with a key) to apply new entries.')
  }

  useEffect(() => {
    const owned = ownedRef.current!
    owned.start()
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
        parent?.children.delete(owned.close)
        void owned.close()
        if (ownedRef.current === owned) ownedRef.current = null
      })
    }
  }, [parent])

  return <ProviderContext.Provider value={ownedRef.current.state}>{children}</ProviderContext.Provider>
}
