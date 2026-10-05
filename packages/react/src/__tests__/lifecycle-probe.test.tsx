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
 * A single ordered trace (acquire / render / release, all pushed at the
 * moment they happen) proves the properties directly, rather than comparing
 * sets or a final snapshot: those would hide a render observing an
 * already-released instance, or a double release, if the interleaving were
 * wrong. Decision recorded in the spec's Decision Context.
 */
import { describe, it, expect } from 'vitest'
import { useEffect, useRef, useState } from 'react'
import { Context, Effect } from 'effect'
import { makeAppScope, type AppScope, type ChildScope } from '@sleekstack/core'
import { service } from './service-helper'
import { renderStrict } from './renderStrict'

// --- Ordered trace: every acquire/render/release records its position ---

type Event = { readonly kind: 'acquire' | 'render' | 'release'; readonly id: number }

/** Every render observed an id acquired strictly before, and released strictly after (or not yet). */
function assertNeverRendersAReleasedInstance(trace: readonly Event[]): void {
  const releasedAt = new Map<number, number>()
  trace.forEach((e, i) => {
    if (e.kind !== 'release') return
    expect(releasedAt.has(e.id)).toBe(false) // no id released twice
    releasedAt.set(e.id, i)
  })
  trace.forEach((e, i) => {
    if (e.kind !== 'render') return
    const releaseIndex = releasedAt.get(e.id)
    if (releaseIndex !== undefined) expect(i).toBeLessThan(releaseIndex)
  })
}

/** Every acquired id was eventually released exactly once — nothing leaks, nothing double-frees. */
function assertEveryAcquisitionReleasedExactlyOnce(trace: readonly Event[]): void {
  const acquired = trace
    .filter((e) => e.kind === 'acquire')
    .map((e) => e.id)
    .sort((a, b) => a - b)
  const released = trace
    .filter((e) => e.kind === 'release')
    .map((e) => e.id)
    .sort((a, b) => a - b)
  expect(released).toEqual(acquired)
}

// --- Tracked component-lifetime service: an acquire/release pair per instance, id per instance ---

interface Counter {
  readonly id: number
}
const CounterTag = Context.GenericTag<Counter>('lifecycle-probe/Counter')

const makeTrackedEntry = (trace: Event[]) => {
  let nextId = 0
  return service(CounterTag, { lifetime: 'component' }, () =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const id = ++nextId
        trace.push({ kind: 'acquire', id })
        return { id }
      }),
      (counter) => Effect.sync(() => void trace.push({ kind: 'release', id: counter.id })),
    ),
  )
}

const makeApp = (): AppScope => Effect.runSync(makeAppScope([]))

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
  trace,
}: {
  app: AppScope
  entries: Parameters<AppScope['child']>[1]
  trace: Event[]
}) {
  const scope = useDeferredDisposeScope(app, entries)
  const counter = Context.get(scope.context, CounterTag)
  trace.push({ kind: 'render', id: counter.id })
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
  trace,
}: {
  app: AppScope
  entries: Parameters<AppScope['child']>[1]
  trace: Event[]
}) {
  const scope = useRebuildOnRemountScope(app, entries)
  const counter = Context.get(scope.context, CounterTag)
  trace.push({ kind: 'render', id: counter.id })
  return null
}

// --- Assertions ---

describe('React lifecycle probe (R9): StrictMode-safe component-scope strategy', () => {
  it('[deferred dispose] never renders a released instance, exactly one acquisition, released once on real unmount', async () => {
    const trace: Event[] = []
    const app = makeApp()
    const entries = [makeTrackedEntry(trace)]

    const { unmount } = renderStrict(<DeferredDisposeProbe app={app} entries={entries} trace={trace} />)

    // Let any StrictMode double-invoke settle (cancellation runs synchronously,
    // but give a microtask turn in case anything was queued).
    await Promise.resolve()

    // No double acquisition visible after settle: the StrictMode double-invoke
    // never disposed the instance every render saw.
    expect(trace.filter((e) => e.kind === 'acquire')).toEqual([{ kind: 'acquire', id: 1 }])
    assertNeverRendersAReleasedInstance(trace)

    unmount()
    await new Promise<void>((resolve) => queueMicrotask(() => queueMicrotask(() => resolve())))

    // Still exactly one acquisition (real unmount released the same instance
    // StrictMode's double-invoke reused, not a second one), every render saw
    // id 1, and it was released exactly once.
    expect(trace.filter((e) => e.kind === 'acquire')).toEqual([{ kind: 'acquire', id: 1 }])
    expect(trace.filter((e) => e.kind === 'render').every((e) => e.id === 1)).toBe(true)
    assertNeverRendersAReleasedInstance(trace)
    assertEveryAcquisitionReleasedExactlyOnce(trace)
  })

  it('[rebuild on remount] never renders a released instance, one instance per acquisition, all released on real unmount', async () => {
    const trace: Event[] = []
    const app = makeApp()
    const entries = [makeTrackedEntry(trace)]

    const { unmount } = renderStrict(<RebuildOnRemountProbe app={app} entries={entries} trace={trace} />)

    await Promise.resolve()

    // Rebuild-on-remount acquires a fresh instance across the StrictMode
    // mount/cleanup/remount cycle (the transient instance built for the
    // StrictMode render is disposed, a new one is rebuilt for the settled
    // render) — but no render ever observed an instance whose release had
    // already run, in that exact ordered trace.
    assertNeverRendersAReleasedInstance(trace)
    expect(trace.filter((e) => e.kind === 'acquire').length).toBeGreaterThan(0)

    unmount()
    await new Promise<void>((resolve) => queueMicrotask(() => queueMicrotask(() => resolve())))

    // Every acquired instance (transient StrictMode build included) was
    // eventually released exactly once; nothing leaks, nothing double-frees.
    assertNeverRendersAReleasedInstance(trace)
    assertEveryAcquisitionReleasedExactlyOnce(trace)
  })
})
