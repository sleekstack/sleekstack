// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import { Cause, Context, Data, Deferred, Effect, Layer } from 'effect'
import { act, createElement, useEffect, useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Boundary, el, fromReact, mount, type Mounted, Provider, Store, useAtomValue, useLocal, useSetAtom } from '../index'
import type { Node } from '../node'
import { Fragment, jsx as rawJsx } from '../jsx-runtime'
import { useMutation, useQuery, useQueryClient } from '../query'
import { QueryClientLive } from '@sleekstack/query'
import type { QueryClient } from '@tanstack/query-core'

const useEffectLog = (log: (e: string) => void) => useEffect(() => (log('mount'), () => log('unmount')), [])

const jsx = (type: any, props: any) => rawJsx(type, props)
const tick = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))

// Active store subscriptions per atom, for stores made by `counted`.
const subs = new Map<unknown, number>()
const counted = () => {
  const store = makeAtomStore()
  const subscribe = store.subscribe
  vi.spyOn(store, 'subscribe').mockImplementation((atom, f) => {
    subs.set(atom, (subs.get(atom) ?? 0) + 1)
    const off = subscribe(atom, f)
    return () => (subs.set(atom, subs.get(atom)! - 1), off())
  })
  return store
}

let handles: Array<Mounted> = []
beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})
afterEach(async () => {
  await act(async () => {
    for (const h of handles) await h.dispose()
  })
  handles = []
})
const go = async (app: any, opts: Partial<Parameters<typeof mount>[1]> = {}) => {
  const container = document.createElement('div')
  const store = opts.store ?? makeAtomStore()
  await act(async () => void handles.push(await mount(app, { layer: Layer.empty, container, store, ...opts } as any)))
  return { container, store, handle: handles[handles.length - 1]! }
}

class Greeting extends Context.Tag('Greeting')<Greeting, string>() {}
class Boom extends Data.TaggedError('Boom')<{}> {}
class Other extends Data.TaggedError('Other')<{}> {}

describe('reactive DOM', () => {
  it('re-runs only the reader; siblings and ancestors keep their nodes; sees the enclosing Provider', async () => {
    const a = Atom.make(1)
    const b = Atom.make(1)
    let runsB = 0
    const A = () => Effect.zipWith(Greeting, useAtomValue(a), (g, n) => el('i', {}, `${g}${n}`))
    const B = () => Effect.map(useAtomValue(b), (n) => (runsB++, el('u', {}, String(n))))
    const tree = jsx('section', { children: [jsx(Provider, { layer: Layer.succeed(Greeting, 'hi'), children: jsx(A, {}) }), jsx(B, {})] })
    const { container, store } = await go(tree)
    const section = container.firstChild!
    const uNode = container.querySelector('u')
    store.set(a, 2)
    await tick()
    expect(container.querySelector('i')!.textContent).toBe('hi2')
    expect(container.firstChild).toBe(section)
    expect(container.querySelector('u')).toBe(uNode)
    expect(runsB).toBe(1)
  })

  it('latest wins: a slow earlier re-run is interrupted and never writes', async () => {
    const a = Atom.make(0)
    const gate = Effect.runSync(Deferred.make<void>())
    const interrupted = vi.fn()
    const C = () =>
      Effect.flatMap(useAtomValue(a), (n) =>
        (n === 1 ? Deferred.await(gate).pipe(Effect.onInterrupt(() => Effect.sync(interrupted))) : Effect.void).pipe(Effect.as(el('b', {}, String(n)))),
      )
    const { container, store } = await go(jsx(C, {}))
    store.set(a, 1)
    await tick()
    store.set(a, 2)
    await tick()
    await act(() => Effect.runPromise(Deferred.succeed(gate, undefined)))
    await tick()
    expect(container.textContent).toBe('2')
    expect(interrupted).toHaveBeenCalledOnce()
  })

  it('handled re-run failure renders the Boundary fallback; unhandled keeps DOM, reports once, retries; throwing onError is logged', async () => {
    const a = Atom.make(0)
    const C = () => Effect.flatMap(useAtomValue(a), (n): Effect.Effect<any, Boom | Other> => (n === 1 ? Effect.fail(new Boom()) : n === 2 ? Effect.fail(new Other()) : Effect.succeed(el('b', {}, String(n)))))
    const onError = vi.fn(() => {
      throw new Error('sink')
    })
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const tree = jsx(Boundary, { tag: 'Boom', fallback: () => Effect.succeed(el('p', {}, 'caught')), children: jsx(C, {}) })
    const { container, store } = await go(tree, { onError })
    store.set(a, 1)
    await tick()
    expect(container.textContent).toBe('caught')
    store.set(a, 2)
    await tick()
    expect(container.textContent).toBe('caught')
    expect(onError).toHaveBeenCalledOnce()
    expect(logged).toHaveBeenCalledWith(expect.objectContaining({ message: 'sink' }))
    store.set(a, 3)
    await tick()
    expect(container.textContent).toBe('3')
    logged.mockRestore()
  })

  it('a guest given the setter updates the reader; a passed store is not disposed; dispose stops everything', async () => {
    const a = Atom.make(0)
    const Btn = fromReact((p: { set: (n: number) => void }) => createElement('button', { onClick: () => p.set(5) }))
    const store = makeAtomStore()
    const dispose = vi.spyOn(store, 'dispose')
    const Reader = () => Effect.map(useAtomValue(a), (n) => el('b', {}, String(n)))
    const Writer = () => Effect.flatMap(useSetAtom(a), (set) => jsx(Btn, { set }))
    const { container, handle } = await go(jsx('div', { children: [jsx(Reader, {}), jsx(Writer, {})] }), { store })
    await act(async () => container.querySelector('button')!.click())
    await tick()
    expect(container.querySelector('b')!.textContent).toBe('5')
    await act(() => handle.dispose())
    expect(container.innerHTML).toBe('')
    store.set(a, 6)
    await tick()
    expect(container.innerHTML).toBe('')
    expect(dispose).not.toHaveBeenCalled()
  })

  it('a superseding mount interrupts in-flight re-runs; late completions write nothing; a created store is disposed', async () => {
    const a = Atom.make(0)
    const gate = Effect.runSync(Deferred.make<void>())
    const interrupted = vi.fn()
    let seen: any
    const C = () =>
      Effect.flatMap(useAtomValue(a), (n) =>
        (n === 1 ? Deferred.await(gate).pipe(Effect.onInterrupt(() => Effect.sync(interrupted))) : Effect.void).pipe(Effect.as(el('b', {}, String(n)))),
      )
    let disposed: any
    const Capture = () =>
      Effect.flatMap(Effect.zip(useSetAtom(a), Store), ([set, store]) => ((seen = set), (disposed = vi.spyOn(store, 'dispose')), jsx(C, {})))
    const container = document.createElement('div')
    await act(async () => void (await mount(jsx(Capture, {}), { layer: Layer.empty, container })))
    seen(1)
    await tick()
    await act(async () => void handles.push(await mount(Effect.succeed(el('p', {}, 'new')), { layer: Layer.empty, container })))
    await act(() => Effect.runPromise(Deferred.succeed(gate, undefined)))
    await tick()
    expect(container.innerHTML).toBe('<p>new</p>')
    expect(interrupted).toHaveBeenCalledOnce()
    expect(disposed).toHaveBeenCalled()
  })

  it('nested: an outer change adopts the inner instance; no double re-run, no leaked subscription', async () => {
    const outer = Atom.make('o1')
    const inner = Atom.make('i1')
    let innerRuns = 0
    const Inner = () => Effect.map(useAtomValue(inner), (v) => (innerRuns++, el('em', {}, v)))
    const Outer = () => Effect.flatMap(useAtomValue(outer), (v) => Effect.map(jsx(Inner, {}), (i) => el('div', {}, el('span', {}, v), i)))
    const { container, store } = await go(jsx(Outer, {}), { store: counted() })
    const span = container.querySelector('span')
    const em = container.querySelector('em')
    store.set(inner, 'i2')
    await tick()
    expect(container.querySelector('em')!.textContent).toBe('i2')
    expect(container.querySelector('span')).toBe(span)
    innerRuns = 0
    store.set(outer, 'o2')
    await tick()
    expect(container.querySelector('span')).toBe(span)
    expect(container.querySelector('em')).toBe(em)
    expect(innerRuns).toBe(1)
    expect(subs.get(inner)).toBe(1)
    store.set(inner, 'i3')
    await tick()
    expect(container.textContent).toBe('o2i3')
    expect(innerRuns).toBe(2)
  })

  it('a matched instance with an in-flight re-run adopts and the latest run wins; a removed instance is fully killed', async () => {
    const outer = Atom.make(0)
    const inner = Atom.make(0)
    const gate = Effect.runSync(Deferred.make<void>())
    const log: Array<string> = []
    const layer = Layer.scoped(Greeting, Effect.acquireRelease(Effect.succeed('g'), () => Effect.sync(() => log.push('released'))))
    let blocked = false
    const Inner = () =>
      Effect.flatMap(useAtomValue(inner), (n) =>
        (n === 1 && !blocked && (blocked = true) ? Deferred.await(gate).pipe(Effect.onInterrupt(() => Effect.sync(() => log.push('interrupted')))) : Effect.void).pipe(Effect.as(el('em', {}, String(n)))),
      )
    const Outer = () => Effect.flatMap(useAtomValue(outer), (o) => (o < 2 ? Effect.map(jsx(Provider, { layer, children: jsx(Inner, {}) }), (i) => el('div', {}, String(o), i)) : Effect.succeed(el('div', {}, 'gone'))))
    const { container, store } = await go(jsx(Outer, {}), { store: counted() })
    const em = container.querySelector('em')
    store.set(inner, 1) // in flight, blocked on the gate
    await tick()
    store.set(outer, 1) // the parent's run reads inner = 1 without blocking and adopts
    await tick()
    expect(container.textContent).toBe('11')
    expect(log).toContain('interrupted')
    expect(container.querySelector('em')).toBe(em)
    expect(subs.get(inner)).toBe(1)
    const released = log.filter((l) => l === 'released').length
    store.set(outer, 2)
    await tick()
    expect(container.textContent).toBe('gone')
    expect(subs.get(inner) ?? 0).toBe(0)
    expect(log.filter((l) => l === 'released').length).toBe(released + 1)
    store.set(inner, 5)
    await tick()
    expect(container.textContent).toBe('gone')
  })

  it('a dropped re-run disposes only its pending slots; a killed instance disposes all its slots', async () => {
    const show = Atom.make(1)
    const fail = Atom.make(false)
    const store = makeAtomStore()
    let held = 0
    const retain = store.retain
    vi.spyOn(store, 'retain').mockImplementation((atom) => {
      held++
      const release = retain(atom)
      return () => (held--, release())
    })
    const L = () => Effect.map(useLocal(0), ([n]) => el('b', {}, String(n)))
    const P = () =>
      Effect.flatMap(useAtomValue(show), (s) =>
        Effect.flatMap(useAtomValue(fail), (f) =>
          Effect.flatMap(Effect.all([s >= 1 ? jsx(L, { key: 'a' }) : Effect.succeed(null), s >= 2 ? jsx(L, { key: 'b' }) : Effect.succeed(null)]), (kids) =>
            f ? Effect.die('boom') : Effect.succeed(el('div', {}, ...kids.filter((k): k is Node => k !== null))),
          ),
        ),
      )
    const onError = vi.fn()
    await go(jsx(P, {}), { store, onError })
    // P's slots plus L(a)'s one slot; useAtomValue holds are run-scoped and released with the run.
    const base = held
    store.set(fail, true)
    store.set(show, 2)
    await tick()
    expect(onError).toHaveBeenCalled()
    expect(held).toBe(base)
    store.set(fail, false)
    await tick()
    expect(held).toBe(base + 2)
    store.set(show, 0)
    await tick()
    expect(held).toBe(base - 2)
  })

  it('a useQuery / useMutation observer keeps its retain across an adopt and is released on kill', async () => {
    const outer = Atom.make(0)
    let client: QueryClient | undefined
    let mutate: (() => void) | undefined
    const Q = () =>
      Effect.zipWith(useQuery({ queryKey: ['adopt'], queryFn: async () => 'v' }), useMutation({ mutationFn: async () => 1 }), (q, m) => ((mutate = m.mutate), el('b', {}, `${q.status}:${m.status}`)))
    const Outer = () =>
      Effect.flatMap(useAtomValue(outer), (o) =>
        Effect.flatMap(useQueryClient(), (c) => ((client = c), o < 2 ? Effect.map(jsx(Q, {}), (q) => el('div', {}, String(o), q)) : Effect.succeed(el('div', {}, 'gone')))),
      )
    const { container, store } = await go(jsx(Outer, {}), { layer: QueryClientLive() as any })
    await tick()
    mutate!()
    await tick()
    expect(container.textContent).toBe('0success:success')
    const observers = () => client!.getQueryCache().find({ queryKey: ['adopt'] })!.getObserversCount()
    expect(observers()).toBe(1)
    store.set(outer, 1)
    await tick()
    expect(container.textContent).toBe('1success:success')
    expect(observers()).toBe(1)
    store.set(outer, 2)
    await tick()
    expect(container.textContent).toBe('gone')
    expect(observers()).toBe(0)
  })

  it('a renderer defect on re-run keeps the old DOM and reports; a run that reads no atoms unsubscribes', async () => {
    const a = Atom.make(0)
    const b = Atom.make(0)
    let runs = 0
    const C = () =>
      Effect.flatMap(useAtomValue(a), (n) => {
        runs++
        return n === 1 ? Effect.succeed(el('bad tag')) : Effect.map(useAtomValue(b), () => el('b', {}, String(n)))
      })
    const onError = vi.fn()
    // At a === 2 the run reads no atom (a plain `get`), so it must drop its subscriptions.
    const Wrapped = () => Effect.flatMap(Store, (s) => (s.get(a) === 2 ? Effect.succeed(el('p', {}, 'done')) : C()))
    const { container, store } = await go(jsx(Wrapped, {}), { onError })
    store.set(a, 1)
    await tick()
    expect(container.innerHTML).toContain('<b>0</b>')
    expect(onError).toHaveBeenCalledOnce()
    store.set(a, 2)
    await tick()
    expect(container.textContent).toBe('done')
    const before = runs
    store.set(b, 1)
    store.set(a, 3)
    await tick()
    expect(runs).toBe(before)
  })

  it('a fallback failing re-run goes to the outer Boundary; a reactive fallback keeps the component retrying', async () => {
    const a = Atom.make(0)
    const msg = Atom.make('m')
    const C = () => Effect.flatMap(useAtomValue(a), (n): Effect.Effect<any, Boom> => (n === 1 ? Effect.fail(new Boom()) : Effect.succeed(el('b', {}, String(n)))))
    const Fb = () => Effect.map(useAtomValue(msg), (m) => el('i', {}, m))
    const inner = jsx(Boundary, { tag: 'Boom', fallback: () => jsx(Fb, {}), children: jsx(C, {}) })
    const { container, store } = await go(inner)
    store.set(a, 1)
    await tick()
    expect(container.textContent).toBe('m')
    store.set(msg, 'n')
    await tick()
    expect(container.textContent).toBe('n')
    store.set(a, 2)
    await tick()
    expect(container.textContent).toBe('2')

    const x = Atom.make(0)
    const D = () => Effect.flatMap(useAtomValue(x), (n): Effect.Effect<any, Boom> => (n === 1 ? Effect.fail(new Boom()) : Effect.succeed(el('b'))))
    const nested = jsx(Boundary, {
      tag: 'Other',
      fallback: () => Effect.succeed(el('p', {}, 'outer')),
      children: jsx(Boundary, { tag: 'Boom', fallback: () => Effect.fail(new Other()), children: jsx(D, {}) }),
    })
    const second = await go(nested)
    second.store.set(x, 1)
    await tick()
    expect(second.container.textContent).toBe('outer')
  })

  it('a scoped mount layer stays alive for re-runs; dispose awaits its release', async () => {
    const a = Atom.make(0)
    const log: Array<string> = []
    const layer = Layer.scoped(Greeting, Effect.acquireRelease(Effect.succeed('hi'), () => Effect.sync(() => log.push('released'))))
    const C = () => Effect.zipWith(Greeting, useAtomValue(a), (g, n) => el('b', {}, `${g}${n}`))
    const { container, store, handle } = await go(jsx(C, {}), { layer: layer as any })
    store.set(a, 1)
    await tick()
    expect(container.textContent).toBe('hi1')
    expect(log).toEqual([])
    await act(() => handle.dispose())
    expect(log).toEqual(['released'])
  })

  it('a run scope is released when its DOM is replaced, not when a defective swap is rejected', async () => {
    const a = Atom.make(0)
    const log: Array<string> = []
    const layer = Layer.scoped(Greeting, Effect.acquireRelease(Effect.succeed('hi'), () => Effect.sync(() => log.push('released'))))
    const Hi = () => Effect.map(Greeting, (g) => el('i', {}, g))
    const C = () => Effect.flatMap(useAtomValue(a), (n) => (n === 1 ? Effect.succeed(el('bad tag')) : jsx(Provider, { layer, children: jsx(Hi, {}) })))
    const { container, store } = await go(jsx(C, {}), { onError: () => {} })
    store.set(a, 1)
    await tick()
    expect(log).toEqual([])
    expect(container.textContent).toBe('hi')
    store.set(a, 2)
    await tick()
    expect(log).toEqual(['released'])
  })

  it('a change between an async first-render read and its subscription re-runs', async () => {
    const a = Atom.make(0)
    const store = makeAtomStore()
    let held = 0
    const retain = store.retain
    vi.spyOn(store, 'retain').mockImplementation((atom) => {
      held++
      const release = retain(atom)
      return () => (held--, release())
    })
    const C = () => Effect.flatMap(useAtomValue(a), (n) => Effect.as(Effect.sleep(10), el('b', {}, String(n))))
    const container = document.createElement('div')
    await act(async () => {
      const pending = mount(jsx(C, {}), { layer: Layer.empty, container, store })
      await new Promise((r) => setTimeout(r, 1)) // the run has read 0 and is sleeping
      store.set(a, 7)
      handles.push(await pending)
    })
    await act(async () => void (await new Promise((r) => setTimeout(r, 30))))
    expect(container.textContent).toBe('7')
    expect(held).toBeGreaterThan(0)
    await act(() => handles.pop()!.dispose())
    expect(held).toBe(0)
  })

  it('a committed fallback releases the replaced run scope; an untracked run scope goes with its ancestor', async () => {
    const a = Atom.make(0)
    const outer = Atom.make(0)
    const log: Array<string> = []
    const layer = (name: string) => Layer.scoped(Greeting, Effect.acquireRelease(Effect.succeed(name), () => Effect.sync(() => log.push(name))))
    const Hi = () => Effect.map(Greeting, (g) => el('i', {}, g))
    const C = () =>
      Effect.flatMap(useAtomValue(a), (n): Effect.Effect<any, Boom> => (n === 1 ? Effect.fail(new Boom()) : jsx(Provider, { layer: layer('c'), children: jsx(Hi, {}) })))
    const Plain = () => jsx(Provider, { layer: layer('plain'), children: jsx(Hi, {}) })
    const Outer = () => Effect.flatMap(useAtomValue(outer), () => jsx(Plain, {}))
    const tree = jsx('div', {
      children: [jsx(Boundary, { tag: 'Boom', fallback: () => Effect.succeed(el('p', {}, 'fb')), children: jsx(C, {}) }), jsx(Outer, {})],
    })
    const { store } = await go(tree)
    store.set(a, 1)
    await tick()
    expect(log).toEqual(['c'])
    store.set(outer, 1)
    await tick()
    expect(log).toEqual(['c', 'plain'])
  })

  it('a reactive fallback that later fails goes to the outer Boundary, not its own', async () => {
    const a = Atom.make(0)
    const f = Atom.make(0)
    const C = () => Effect.flatMap(useAtomValue(a), (n): Effect.Effect<any, Boom> => (n === 1 ? Effect.fail(new Boom()) : Effect.succeed(el('b'))))
    const Fb = () => Effect.flatMap(useAtomValue(f), (n): Effect.Effect<any, Boom> => (n === 1 ? Effect.fail(new Boom()) : Effect.succeed(el('i', {}, 'inner'))))
    const tree = jsx(Boundary, {
      tag: 'Boom',
      fallback: () => Effect.succeed(el('p', {}, 'outer')),
      children: jsx(Boundary, { tag: 'Boom', fallback: () => jsx(Fb, {}), children: jsx(C, {}) }),
    })
    const { container, store } = await go(tree)
    store.set(a, 1)
    await tick()
    expect(container.textContent).toBe('inner')
    store.set(f, 1)
    await tick()
    expect(container.textContent).toBe('outer')
  })
})

describe('reconciler', () => {
  const keyed = (tag: string, key: string, ...children: Array<Node | string>): Node => ({ ...(el(tag, {}, ...children) as any), key })
  // A component whose output follows atom `a`.
  const view = <A,>(a: Atom.Writable<A>, render: (v: A) => Node) => jsx(() => Effect.map(useAtomValue(a), render), {})

  it('a text or attribute change keeps the DOM nodes; a tag change replaces', async () => {
    const a = Atom.make(0)
    const { container, store } = await go(view(a, (n) => el('div', { title: `t${n}` }, n === 2 ? el('i', {}, 'x') : el('b', {}, `v${n}`))))
    const div = container.querySelector('div')!
    const b = container.querySelector('b')!
    const text = b.firstChild
    store.set(a, 1)
    await tick()
    expect(container.querySelector('div')).toBe(div)
    expect(div.getAttribute('title')).toBe('t1')
    expect(container.querySelector('b')).toBe(b)
    expect(b.firstChild).toBe(text)
    expect(text!.nodeValue).toBe('v1')
    store.set(a, 2)
    await tick()
    expect(container.querySelector('b')).toBeNull()
    expect(div.innerHTML).toBe('<i>x</i>')
  })

  it('a focused input keeps focus and typed value when a sibling changes', async () => {
    const a = Atom.make(0)
    const { container, store } = await go(view(a, (n) => el('form', {}, el('p', {}, String(n)), el('input', { value: 'start' }))))
    document.body.appendChild(container)
    const input = container.querySelector('input')!
    input.focus()
    input.value = 'typed'
    store.set(a, 1)
    await tick()
    expect(container.querySelector('p')!.textContent).toBe('1')
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('typed')
    container.remove()
  })

  it('a select value is set after its options', async () => {
    const a = Atom.make('b')
    const { container, store } = await go(view(a, (v) => el('select', { value: v }, ...['a', 'b', 'c'].map((o) => el('option', { value: o }, o)))))
    const select = container.querySelector('select')!
    expect(select.value).toBe('b')
    store.set(a, 'c')
    await tick()
    expect(container.querySelector('select')).toBe(select)
    expect(select.value).toBe('c')
  })

  it('a matched guest keeps its React state and gets new props; removal, component or key change unmounts it; a failed guest stays empty', async () => {
    const mode = Atom.make<{ n: number; show: boolean; other: boolean; key: string }>({ n: 0, show: true, other: false, key: 'a' })
    const log: Array<string> = []
    const Counter = fromReact((p: { n: number }) => {
      const [c, setC] = useState(0)
      useEffectLog((e) => log.push(e))
      return createElement('button', { onClick: () => setC(c + 1) }, `${c}/${p.n}`)
    })
    const Other = fromReact(() => createElement('i', {}, 'other'))
    const C = () =>
      Effect.flatMap(useAtomValue(mode), (m) => {
        const g = m.other ? jsx(Other, {}) : jsx(Counter, { n: m.n, key: m.key })
        return m.show ? Effect.map(g, (g) => el('div', {}, g)) : Effect.succeed(el('div', {}))
      })
    const { container, store } = await go(jsx(C, {}))
    const host = container.querySelector('sleek-guest')
    await act(async () => container.querySelector('button')!.click())
    store.set(mode, { n: 1, show: true, other: false, key: 'a' })
    await tick()
    expect(container.textContent).toBe('1/1')
    expect(container.querySelector('sleek-guest')).toBe(host)
    expect(log).toEqual(['mount'])
    store.set(mode, { n: 1, show: true, other: false, key: 'b' })
    await tick()
    expect(container.textContent).toBe('0/1')
    // The replacement mounts in the plan, before the old root unmounts on commit.
    expect(log).toEqual(['mount', 'mount', 'unmount'])
    store.set(mode, { n: 1, show: true, other: true, key: 'b' })
    await tick()
    expect(container.textContent).toBe('other')
    store.set(mode, { n: 1, show: true, other: false, key: 'b' })
    await tick()
    store.set(mode, { n: 1, show: false, other: false, key: 'b' })
    await tick()
    expect(container.textContent).toBe('')
    expect(log).toEqual(['mount', 'mount', 'unmount', 'unmount', 'mount', 'unmount'])

    const n = Atom.make(0)
    const Thrower = fromReact((p: { n: number }) => {
      if (p.n === 1) throw new Error('guest')
      return createElement('s', {}, String(p.n))
    })
    const onError = vi.fn()
    const R = () => Effect.flatMap(useAtomValue(n), (v) => jsx(Thrower, { n: v }))
    const r = await go(jsx(R, {}), { onError })
    r.store.set(n, 1)
    await tick()
    expect(r.container.textContent).toBe('')
    expect(onError).toHaveBeenCalledOnce()
    r.store.set(n, 2)
    await tick()
    expect(r.container.textContent).toBe('')
  })

  it('a plan failure leaves the live DOM byte-identical and leaks no guest root or scope', async () => {
    const a = Atom.make(0)
    const log: Array<string> = []
    const mounted = vi.fn()
    const G = fromReact(() => {
      useEffectLog(mounted)
      return createElement('span', {}, 'g')
    })
    const layer = Layer.scoped(Greeting, Effect.acquireRelease(Effect.succeed('hi'), () => Effect.sync(() => log.push('released'))))
    const Hi = () => Effect.map(Greeting, (g) => el('i', {}, g))
    // n === 1: a new guest and a Provider scope are planned before the bad tag later in the same list.
    const C = () =>
      Effect.flatMap(useAtomValue(a), (n) =>
        n === 1
          ? Effect.map(Effect.all([jsx(G, {}), jsx(Provider, { layer, children: jsx(Hi, {}) })]), ([g, p]) => el('div', {}, el('b', {}, 'changed'), g, p, el('bad tag')))
          : Effect.succeed(el('div', {}, el('b', {}, String(n)))),
      )
    const onError = vi.fn()
    const { container, store } = await go(jsx(C, {}), { onError })
    const before = container.innerHTML
    const b = container.querySelector('b')
    store.set(a, 1)
    await tick()
    expect(container.innerHTML).toBe(before)
    expect(container.querySelector('b')).toBe(b)
    expect(onError).toHaveBeenCalledOnce()
    expect(mounted.mock.calls.map((c) => c[0])).toEqual(['mount', 'unmount'])
    expect(log).toEqual(['released'])
  })

  it('a run superseded during the plan is dropped with its scopes closed', async () => {
    const a = Atom.make(0)
    const log: Array<string> = []
    const container = document.createElement('div')
    const layer = Layer.scoped(Greeting, Effect.acquireRelease(Effect.succeed('hi'), () => Effect.sync(() => log.push('released'))))
    const Hi = () => Effect.map(Greeting, (g) => el('i', {}, g))
    // Rendering this guest mounts something else into the same container mid-plan.
    const Hijack = fromReact(() => {
      void mount(Effect.succeed(el('p', {}, 'new')), { layer: Layer.empty, container }).then((h) => handles.push(h))
      return null
    })
    const C = () => Effect.flatMap(useAtomValue(a), (n) => (n === 1 ? jsx(Provider, { layer, children: Effect.zipWith(jsx(Hi, {}), jsx(Hijack, {}), (h, g) => el('div', {}, h, g)) }) : Effect.succeed(el('b', {}, 'old'))))
    const store = makeAtomStore()
    await act(async () => void handles.push(await mount(jsx(C, {}), { layer: Layer.empty, container, store })))
    store.set(a, 1)
    await tick()
    await tick()
    expect(container.innerHTML).toBe('<p>new</p>')
    expect(log).toEqual(['released'])
  })

  it('keyed reorder keeps every node; insert and remove touch only the difference', async () => {
    const order = Atom.make(['a', 'b', 'c'])
    const { container, store } = await go(view(order, (ks) => el('ul', {}, ...ks.map((k) => keyed('li', k, k)))))
    const nodes = () => Object.fromEntries([...container.querySelectorAll('li')].map((li) => [li.textContent, li]))
    const first = nodes()
    store.set(order, ['c', 'a', 'b'])
    await tick()
    expect(container.querySelector('ul')!.textContent).toBe('cab')
    expect(nodes()).toEqual(first)
    for (const k of ['a', 'b', 'c']) expect(nodes()[k]).toBe(first[k])
    store.set(order, ['c', 'x', 'b'])
    await tick()
    const after = nodes()
    expect(container.querySelector('ul')!.textContent).toBe('cxb')
    expect(after.c).toBe(first.c)
    expect(after.b).toBe(first.b)
    expect(first.a!.isConnected).toBe(false)
  })

  it('mixed keyed/unkeyed use separate pools; a duplicate key reports once and the later one is unkeyed', async () => {
    const step = Atom.make(0)
    const onError = vi.fn()
    const { container, store } = await go(
      view(step, (n) => el('div', {}, ...(n === 0 ? [el('p', {}, 'u'), keyed('i', 'k', 'k')] : [keyed('i', 'k', 'k'), el('p', {}, 'u'), keyed('i', 'd', '1'), keyed('i', 'd', '2')]))),
      { onError },
    )
    const p = container.querySelector('p')
    const i = container.querySelector('i')
    store.set(step, 1)
    await tick()
    expect(container.querySelector('div')!.innerHTML).toBe('<i>k</i><p>u</p><i>1</i><i>2</i>')
    expect(container.querySelector('p')).toBe(p)
    expect(container.querySelector('i')).toBe(i)
    expect(onError).toHaveBeenCalledOnce()
    expect(Cause.squash(onError.mock.calls[0]![0])).toMatchObject({ _tag: 'DuplicateKey', key: 'd' })
  })

  it('two same-type root components have their own slots, released on dispose', async () => {
    const store = makeAtomStore()
    let held = 0
    const retain = store.retain
    vi.spyOn(store, 'retain').mockImplementation((atom) => {
      held++
      const release = retain(atom)
      return () => (held--, release())
    })
    const sets: Array<(n: number) => void> = []
    const C = () => Effect.map(useLocal(0), ([n, set]) => (sets.push(set), el('b', {}, String(n))))
    const { container, handle } = await go(jsx(Fragment, { children: [jsx(C, {}), jsx(C, {})] }), { store })
    sets[0]!(5)
    await tick()
    expect(container.textContent).toBe('50')
    expect(held).toBeGreaterThan(0)
    await act(() => handle.dispose())
    expect(held).toBe(0)
  })

  it('an unkeyed sibling keeps its local state when a keyed one of the same type comes or goes', async () => {
    const show = Atom.make(false)
    let setU: ((n: number) => void) | undefined
    const C = (p: { tag: string }) => Effect.map(useLocal(0), ([n, set]) => (p.tag === 'u' && (setU = set), el('b', {}, `${p.tag}${n}`)))
    const P = () => Effect.flatMap(useAtomValue(show), (s) => jsx('div', { children: [s ? jsx(C, { tag: 'k', key: 'k' }) : null, jsx(C, { tag: 'u' })] }))
    const { container, store } = await go(jsx(P, {}))
    setU!(7)
    await tick()
    expect(container.textContent).toBe('u7')
    store.set(show, true)
    await tick()
    expect(container.textContent).toBe('k0u7')
    store.set(show, false)
    await tick()
    expect(container.textContent).toBe('u7')
  })
})
