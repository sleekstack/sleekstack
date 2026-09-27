/**
 * packages/react/src/__tests__/lifecycle-probe.test.tsx
 *
 * Probe for fn-1 task .6 (R9 StrictMode). Compares two provider lifecycle
 * strategies for owning a core component scope across React's StrictMode
 * double-invoke (mount -> cleanup -> remount, synchronously, in dev):
 *
 *   (a) deferred dispose — cleanup schedules the scope's dispose on a
 *       microtask; a remount before that microtask runs cancels it, so the
 *       StrictMode probe reuses the same scope instance.
 *   (b) rebuild on remount — cleanup disposes the scope immediately and nulls
 *       the ref; a forced re-render (triggered from the same cleanup) rebuilds
 *       a fresh scope in the render body.
 *
 * Both are implemented here directly over `@sleekstack/core`'s scope runtime
 * (`makeAppScope` / `ChildScope.child`), not a plain `ManagedRuntime` — the
 * real provider (task .7) is rewritten on that scope runtime, so the probe's
 * result transfers directly. This is a throwaway probe: neither component is
 * exported, and `packages/react/src/LayerProvider.tsx` (the failed prior
 * approach — immediate dispose + ref reset, no cancellation) is not reused.
 *
 * Decision recorded in the spec's Decision Context.
 */
import { describe, it, expect } from 'vitest'
import { useEffect, useRef, useState } from 'react'
import { Context, Effect } from 'effect'
import { buildGraph, makeAppScope, service, type AppScope, type ChildScope } from '@sleekstack/core'
import { renderStrict } from './renderStrict'

// --- Tracked component-lifetime service: counts acquires/releases, tags each instance ---

interface Counter {
  readonly id: number
}
const CounterTag = Context.GenericTag<Counter>('lifecycle-probe/Counter')

const makeTrackedEntry = (log: string[]) => {
  let nextId = 0
  return service(CounterTag, { lifetime: 'component' }, () =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const id = ++nextId
        log.push(`+${id}`)
        return { id }
      }),
      (counter) => Effect.sync(() => void log.push(`-${counter.id}`)),
    ),
  )
}

const makeApp = (): AppScope => Effect.runSync(makeAppScope(buildGraph([])))

// --- Strategy (a): deferred dispose, cancelled on remount ---

function useDeferredDisposeScope(app: AppScope, entries: Parameters<AppScope['child']>[1]): ChildScope {
  const scopeRef = useRef<ChildScope | null>(null)
  const pendingRef = useRef<{ cancelled: boolean } | null>(null)

  if (scopeRef.current === null) {
    scopeRef.current = Effect.runSync(app.child('component', entries))
  }

  useEffect(() => {
    // A remount before the deferred dispose ran: cancel it, keep the scope.
    if (pendingRef.current !== null) {
      pendingRef.current.cancelled = true
      pendingRef.current = null
    }
    return () => {
      const token = { cancelled: false }
      pendingRef.current = token
      const scope = scopeRef.current
      queueMicrotask(() => {
        if (token.cancelled) return
        scope?.dispose()
        if (scopeRef.current === scope) scopeRef.current = null
      })
    }
  }, [])

  return scopeRef.current
}

function DeferredDisposeProbe({
  app,
  entries,
  onId,
}: {
  app: AppScope
  entries: Parameters<AppScope['child']>[1]
  onId: (id: number) => void
}) {
  const scope = useDeferredDisposeScope(app, entries)
  const counter = Context.get(scope.context, CounterTag)
  onId(counter.id)
  return null
}

// --- Strategy (b): rebuild on remount ---

function useRebuildOnRemountScope(app: AppScope, entries: Parameters<AppScope['child']>[1]): ChildScope {
  const scopeRef = useRef<ChildScope | null>(null)
  const [, forceRender] = useState(0)

  if (scopeRef.current === null) {
    scopeRef.current = Effect.runSync(app.child('component', entries))
  }

  useEffect(() => {
    return () => {
      scopeRef.current?.dispose()
      scopeRef.current = null
      // If this is a StrictMode remount, force the next render to rebuild above;
      // if it is a real unmount, this schedules a no-op update on a gone fiber.
      forceRender((g) => g + 1)
    }
  }, [])

  return scopeRef.current
}

function RebuildOnRemountProbe({
  app,
  entries,
  onId,
}: {
  app: AppScope
  entries: Parameters<AppScope['child']>[1]
  onId: (id: number) => void
}) {
  const scope = useRebuildOnRemountScope(app, entries)
  const counter = Context.get(scope.context, CounterTag)
  onId(counter.id)
  return null
}

// --- Assertions ---

describe('React lifecycle probe (R9): StrictMode-safe component-scope strategy', () => {
  it('[deferred dispose] resolves under renderStrict without exposing a disposed scope, one acquisition, one release on real unmount', async () => {
    const log: string[] = []
    const app = makeApp()
    const entries = [makeTrackedEntry(log)]
    const seenIds: number[] = []

    const { unmount } = renderStrict(<DeferredDisposeProbe app={app} entries={entries} onId={(id) => seenIds.push(id)} />)

    // Let any StrictMode double-invoke settle (cancellation runs synchronously,
    // but give a microtask turn in case anything was queued).
    await Promise.resolve()

    // No double acquisition visible after settle, and the context always exposed
    // a live (non-disposed) instance — every render saw the same id.
    expect(log.filter((e) => e.startsWith('+'))).toEqual(['+1'])
    expect(new Set(seenIds)).toEqual(new Set([1]))

    unmount()
    await new Promise<void>((resolve) => queueMicrotask(() => queueMicrotask(() => resolve())))

    expect(log).toEqual(['+1', '-1'])
  })

  it('[rebuild on remount] resolves under renderStrict without exposing a disposed scope, one visible instance, one release on real unmount', async () => {
    const log: string[] = []
    const app = makeApp()
    const entries = [makeTrackedEntry(log)]
    const seenIds: number[] = []

    const { unmount } = renderStrict(<RebuildOnRemountProbe app={app} entries={entries} onId={(id) => seenIds.push(id)} />)

    await Promise.resolve()

    // Rebuild-on-remount acquires a fresh instance across the StrictMode
    // mount/cleanup/remount cycle (id 1 built by the transient StrictMode
    // render is disposed, id 2 rebuilt for the settled render) — but the id
    // the *settled* (last) render exposed through context was never one
    // whose release had already run: no consumer ever observed a disposed
    // instance.
    const releasedIds = () => new Set(log.filter((e) => e.startsWith('-')).map((e) => Number(e.slice(1))))
    const settledId = seenIds.at(-1)!
    expect(releasedIds().has(settledId)).toBe(false)

    unmount()
    await new Promise<void>((resolve) => queueMicrotask(() => queueMicrotask(() => resolve())))

    // Every acquired instance (transient StrictMode build included) was
    // eventually released; nothing leaks.
    const acquiredIds = new Set(log.filter((e) => e.startsWith('+')).map((e) => Number(e.slice(1))))
    expect(releasedIds()).toEqual(acquiredIds)
  })
})
