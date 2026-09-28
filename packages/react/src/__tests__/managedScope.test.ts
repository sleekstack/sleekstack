import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { Context, Effect } from 'effect'
import { service } from '@sleekstack/core'
import { ADOPT_MS, acquire, commit, type ScopeProps } from '../managedScope'

const flush = () => new Promise<void>((r) => queueMicrotask(r))
const noSink = () => {}
const props = (provide: ScopeProps['provide'], label = 'a'): ScopeProps => ({ provide, children: React.createElement('div', { id: label }) })

afterEach(() => void vi.useRealTimers())

describe('managedScope', () => {
  const entries: ScopeProps['provide'] = []

  it('a retry with the same props adopts the parked scope', async () => {
    const p = props(entries, 't1')
    const first = acquire(p, null, noSink)
    expect(acquire(p, null, noSink)).toBe(first)
    await first.close()
  })

  it('owner identity wins over new props', async () => {
    const owner = {}
    const first = acquire({ ...props(entries, 't2'), owner }, null, noSink)
    expect(acquire({ ...props(entries, 't2o'), owner }, null, noSink)).toBe(first)
    await first.close()
  })

  it('new props adopt by shape only once the park is stale (after its task)', async () => {
    const first = acquire(props(entries, 't3'), null, noSink)
    const sibling = acquire(props(entries, 't3'), null, noSink)
    expect(sibling).not.toBe(first) // same slice: siblings never share
    await flush()
    expect(acquire(props(entries, 't3'), null, noSink)).toBe(first) // oldest stale park
    expect(acquire(props(entries, 't3b'), null, noSink)).not.toBe(sibling) // different children shape
    await Promise.all([first.close(), sibling.close()])
  })

  it('pins the known limit: identical siblings in different slices of one pass share a scope', async () => {
    const a = acquire(props(entries, 't4'), null, noSink)
    await flush() // the next time slice
    const b = acquire(props(entries, 't4'), null, noSink)
    expect(b).toBe(a)
    await a.close()
  })

  it('closes a parked scope nobody adopts after ADOPT_MS; a committed one stays', async () => {
    vi.useFakeTimers()
    const lost = acquire(props(entries, 't5'), null, noSink)
    const kept = acquire(props(entries, 't5'), null, noSink)
    commit(kept)
    await vi.runAllTimersAsync()
    vi.advanceTimersByTime(ADOPT_MS)
    await vi.runAllTimersAsync()
    expect(lost.state.started).toBe(false)
    expect(acquire(props(entries, 't5'), null, noSink)).not.toBe(lost) // GC removed it from the park
    await kept.close()
    expect(kept.state.scopeState.status).toBe('resolved')
  })

  it('closes nested providers, then the component scope, then the app scope', async () => {
    const order: string[] = []
    const App = Context.GenericTag<object>('MsApp')
    const Comp = Context.GenericTag<object>('MsComp')
    const fin = (name: string) => Effect.acquireRelease(Effect.succeed({}), () => Effect.sync(() => void order.push(name)))
    const owned = acquire(
      props([service(App, { lifetime: 'app' }, () => fin('app')), service(Comp, { lifetime: 'component' }, () => fin('component'))]),
      null,
      noSink,
    )
    commit(owned)
    await owned.state.scope
    owned.state.children.add(async () => void order.push('nested'))
    await owned.close()
    expect(order).toEqual(['nested', 'component', 'app'])
    expect(owned.state.atoms).toBeDefined()
  })
})
