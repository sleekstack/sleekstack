// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import { Cause, Context, Data, Deferred, Effect, Layer, Schema } from 'effect'
import { act, createElement, useEffect, useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  Boundary,
  el,
  fromReact,
  mount,
  type Mounted,
  Provider,
  renderToString,
  Store,
  useAtomValue,
  useLocal,
  useEffect as useUiEffect,
  useSetAtom,
} from '../index'
import type { Node } from '../node'
import { Fragment, jsx as rawJsx } from '../jsx-runtime'

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
    const tree = jsx('section', {
      children: [jsx(Provider, { layer: Layer.succeed(Greeting, 'hi'), children: jsx(A, {}) }), jsx(B, {})],
    })
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
        (n === 1 ? Deferred.await(gate).pipe(Effect.onInterrupt(() => Effect.sync(interrupted))) : Effect.void).pipe(
          Effect.as(el('b', {}, String(n))),
        ),
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
    const C = () =>
      Effect.flatMap(useAtomValue(a), (n): Effect.Effect<any, Boom | Other> =>
        n === 1 ? Effect.fail(new Boom()) : n === 2 ? Effect.fail(new Other()) : Effect.succeed(el('b', {}, String(n))),
      )
    const onError = vi.fn(() => {
      throw new Error('sink')
    })
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const tree = jsx(Boundary, {
      tag: 'Boom',
      fallback: () => Effect.succeed(el('p', {}, 'caught')),
      children: jsx(C, {}),
    })
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
        (n === 1 ? Deferred.await(gate).pipe(Effect.onInterrupt(() => Effect.sync(interrupted))) : Effect.void).pipe(
          Effect.as(el('b', {}, String(n))),
        ),
      )
    let disposed: any
    const Capture = () =>
      Effect.flatMap(
        Effect.zip(useSetAtom(a), Store),
        ([set, store]) => ((seen = set), (disposed = vi.spyOn(store, 'dispose')), jsx(C, {})),
      )
    const container = document.createElement('div')
    await act(async () => void (await mount(jsx(Capture, {}), { layer: Layer.empty, container })))
    seen(1)
    await tick()
    await act(
      async () => void handles.push(await mount(Effect.succeed(el('p', {}, 'new')), { layer: Layer.empty, container })),
    )
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
    const Outer = () =>
      Effect.flatMap(useAtomValue(outer), (v) => Effect.map(jsx(Inner, {}), (i) => el('div', {}, el('span', {}, v), i)))
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
    expect(innerRuns).toBe(0) // the inner reads an atom: only that atom re-runs it
    expect(subs.get(inner)).toBe(1)
    store.set(inner, 'i3')
    await tick()
    expect(container.textContent).toBe('o2i3')
    expect(innerRuns).toBe(1)
  })

  it('a matched instance with an in-flight re-run adopts and the latest run wins; a removed instance is fully killed', async () => {
    const outer = Atom.make(0)
    const inner = Atom.make(0)
    const gate = Effect.runSync(Deferred.make<void>())
    const log: Array<string> = []
    const layer = Layer.scoped(
      Greeting,
      Effect.acquireRelease(Effect.succeed('g'), () => Effect.sync(() => log.push('released'))),
    )
    let blocked = false
    const Inner = () =>
      Effect.flatMap(useAtomValue(inner), (n) =>
        (n === 1 && !blocked && (blocked = true)
          ? Deferred.await(gate).pipe(Effect.onInterrupt(() => Effect.sync(() => log.push('interrupted'))))
          : Effect.void
        ).pipe(Effect.as(el('em', {}, String(n)))),
      )
    const Outer = () =>
      Effect.flatMap(useAtomValue(outer), (o) =>
        o < 2
          ? Effect.map(jsx(Provider, { layer, children: jsx(Inner, {}) }), (i) => el('div', {}, String(o), i))
          : Effect.succeed(el('div', {}, 'gone')),
      )
    const { container, store } = await go(jsx(Outer, {}), { store: counted() })
    const em = container.querySelector('em')
    store.set(inner, 1) // in flight, blocked on the gate
    await tick()
    store.set(outer, 1) // the parent re-runs; the inner's own in-flight re-run is not its business
    await tick()
    expect(container.textContent).toBe('10')
    expect(log).not.toContain('interrupted')
    Effect.runSync(Deferred.succeed(gate, undefined))
    await tick()
    expect(container.textContent).toBe('11')
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
          Effect.flatMap(
            Effect.all([
              s >= 1 ? jsx(L, { key: 'a' }) : Effect.succeed(null),
              s >= 2 ? jsx(L, { key: 'b' }) : Effect.succeed(null),
            ]),
            (kids) =>
              f ? Effect.die('boom') : Effect.succeed(el('div', {}, ...kids.filter((k): k is Node => k !== null))),
          ),
        ),
      )
    const onError = vi.fn()
    await go(jsx(P, {}), { store, onError })
    // P's holds plus L(a)'s one slot; useAtomValue holds are run-scoped and released with the run; useLocal needs none beyond its slot.
    const base = held
    store.set(fail, true)
    store.set(show, 2)
    await tick()
    expect(onError).toHaveBeenCalled()
    expect(held).toBe(base)
    store.set(fail, false)
    await tick()
    expect(held).toBe(base + 1)
    store.set(show, 0)
    await tick()
    expect(held).toBe(base - 1)
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
    const C = () =>
      Effect.flatMap(useAtomValue(a), (n): Effect.Effect<any, Boom> =>
        n === 1 ? Effect.fail(new Boom()) : Effect.succeed(el('b', {}, String(n))),
      )
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
    const D = () =>
      Effect.flatMap(useAtomValue(x), (n): Effect.Effect<any, Boom> =>
        n === 1 ? Effect.fail(new Boom()) : Effect.succeed(el('b')),
      )
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
    const layer = Layer.scoped(
      Greeting,
      Effect.acquireRelease(Effect.succeed('hi'), () => Effect.sync(() => log.push('released'))),
    )
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
    const layer = Layer.scoped(
      Greeting,
      Effect.acquireRelease(Effect.succeed('hi'), () => Effect.sync(() => log.push('released'))),
    )
    const Hi = () => Effect.map(Greeting, (g) => el('i', {}, g))
    const C = () =>
      Effect.flatMap(useAtomValue(a), (n) =>
        n === 1 ? Effect.succeed(el('bad tag')) : jsx(Provider, { layer, children: jsx(Hi, {}) }),
      )
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
    const layer = (name: string) =>
      Layer.scoped(
        Greeting,
        Effect.acquireRelease(Effect.succeed(name), () => Effect.sync(() => log.push(name))),
      )
    const Hi = () => Effect.map(Greeting, (g) => el('i', {}, g))
    const C = () =>
      Effect.flatMap(useAtomValue(a), (n): Effect.Effect<any, Boom> =>
        n === 1 ? Effect.fail(new Boom()) : jsx(Provider, { layer: layer('c'), children: jsx(Hi, {}) }),
      )
    const Plain = () => jsx(Provider, { layer: layer('plain'), children: jsx(Hi, {}) })
    const Outer = () => Effect.flatMap(useAtomValue(outer), () => jsx(Plain, {}))
    const tree = jsx('div', {
      children: [
        jsx(Boundary, { tag: 'Boom', fallback: () => Effect.succeed(el('p', {}, 'fb')), children: jsx(C, {}) }),
        jsx(Outer, {}),
      ],
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
    const C = () =>
      Effect.flatMap(useAtomValue(a), (n): Effect.Effect<any, Boom> =>
        n === 1 ? Effect.fail(new Boom()) : Effect.succeed(el('b')),
      )
    const Fb = () =>
      Effect.flatMap(useAtomValue(f), (n): Effect.Effect<any, Boom> =>
        n === 1 ? Effect.fail(new Boom()) : Effect.succeed(el('i', {}, 'inner')),
      )
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
  const keyed = (tag: string, key: string, ...children: Array<Node | string>): Node => ({
    ...(el(tag, {}, ...children) as any),
    key,
  })
  // A component whose output follows atom `a`.
  const view = <A>(a: Atom.Writable<A>, render: (v: A) => Node) => jsx(() => Effect.map(useAtomValue(a), render), {})

  it('a text or attribute change keeps the DOM nodes; a tag change replaces', async () => {
    const a = Atom.make(0)
    const { container, store } = await go(
      view(a, (n) => el('div', { title: `t${n}` }, n === 2 ? el('i', {}, 'x') : el('b', {}, `v${n}`))),
    )
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
    const { container, store } = await go(
      view(a, (n) => el('form', {}, el('p', {}, String(n)), el('input', { value: 'start' }))),
    )
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
    const { container, store } = await go(
      view(a, (v) => el('select', { value: v }, ...['a', 'b', 'c'].map((o) => el('option', { value: o }, o)))),
    )
    const select = container.querySelector('select')!
    expect(select.value).toBe('b')
    store.set(a, 'c')
    await tick()
    expect(container.querySelector('select')).toBe(select)
    expect(select.value).toBe('c')
  })

  it('a matched guest keeps its React state and gets new props; removal, component or key change unmounts it; a failed guest stays empty', async () => {
    const mode = Atom.make<{ n: number; show: boolean; other: boolean; key: string }>({
      n: 0,
      show: true,
      other: false,
      key: 'a',
    })
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
    const layer = Layer.scoped(
      Greeting,
      Effect.acquireRelease(Effect.succeed('hi'), () => Effect.sync(() => log.push('released'))),
    )
    const Hi = () => Effect.map(Greeting, (g) => el('i', {}, g))
    // n === 1: a new guest and a Provider scope are planned before the bad tag later in the same list.
    const C = () =>
      Effect.flatMap(useAtomValue(a), (n) =>
        n === 1
          ? Effect.map(Effect.all([jsx(G, {}), jsx(Provider, { layer, children: jsx(Hi, {}) })]), ([g, p]) =>
              el('div', {}, el('b', {}, 'changed'), g, p, el('bad tag')),
            )
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
    const layer = Layer.scoped(
      Greeting,
      Effect.acquireRelease(Effect.succeed('hi'), () => Effect.sync(() => log.push('released'))),
    )
    const Hi = () => Effect.map(Greeting, (g) => el('i', {}, g))
    // Rendering this guest mounts something else into the same container mid-plan.
    const Hijack = fromReact(() => {
      void mount(Effect.succeed(el('p', {}, 'new')), { layer: Layer.empty, container }).then((h) => handles.push(h))
      return null
    })
    const C = () =>
      Effect.flatMap(useAtomValue(a), (n) =>
        n === 1
          ? jsx(Provider, {
              layer,
              children: Effect.zipWith(jsx(Hi, {}), jsx(Hijack, {}), (h, g) => el('div', {}, h, g)),
            })
          : Effect.succeed(el('b', {}, 'old')),
      )
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

  it('any sequence of reorders, inserts and removals leaves the DOM in order and keeps surviving nodes', async () => {
    const universe = Array.from({ length: 12 }, (_, i) => `k${i}`)
    let seed = 7
    const rand = (n: number) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n
    const order = Atom.make<ReadonlyArray<string>>([])
    const { container, store } = await go(view(order, (ks) => el('ul', {}, ...ks.map((k) => keyed('li', k, k)))))
    const nodes = () => new Map([...container.querySelectorAll('li')].map((li) => [li.textContent!, li]))
    let before = nodes()
    for (let step = 0; step < 40; step++) {
      const shuffled = [...universe].sort(() => rand(3) - 1)
      const next = shuffled.slice(0, rand(universe.length + 1))
      store.set(order, next)
      await tick()
      expect(container.querySelector('ul')!.textContent).toBe(next.join(''))
      const after = nodes()
      for (const k of next) if (before.has(k)) expect(after.get(k)).toBe(before.get(k))
      before = after
    }
  })

  it('mixed keyed/unkeyed use separate pools; a duplicate key reports once and the later one is unkeyed', async () => {
    const step = Atom.make(0)
    const onError = vi.fn()
    const { container, store } = await go(
      view(step, (n) =>
        el(
          'div',
          {},
          ...(n === 0
            ? [el('p', {}, 'u'), keyed('i', 'k', 'k')]
            : [keyed('i', 'k', 'k'), el('p', {}, 'u'), keyed('i', 'd', '1'), keyed('i', 'd', '2')]),
        ),
      ),
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
    const C = (p: { tag: string }) =>
      Effect.map(useLocal(0), ([n, set]) => (p.tag === 'u' && (setU = set), el('b', {}, `${p.tag}${n}`)))
    const P = () =>
      Effect.flatMap(useAtomValue(show), (s) =>
        jsx('div', { children: [s ? jsx(C, { tag: 'k', key: 'k' }) : null, jsx(C, { tag: 'u' })] }),
      )
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

describe('host events', () => {
  const click = (c: Element, sel = 'button') =>
    c.querySelector(sel)!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

  it('a closure sees Provider layers above the element, including inside an atom-free component', async () => {
    const seen: Array<string> = []
    const Btn = () => jsx('button', { onClick: () => Effect.map(Greeting, (g) => void seen.push(g)) })
    const Mid = () => jsx(Provider, { layer: Layer.succeed(Greeting, 'inner'), children: jsx(Btn, {}) })
    const { container } = await go(
      jsx(Provider, {
        layer: Layer.succeed(Greeting, 'outer'),
        children: jsx('div', { children: [jsx(Btn, {}), jsx(Mid, {})] }),
      }),
    )
    for (const b of container.querySelectorAll('button')) b.click()
    expect(seen).toEqual(['outer', 'inner'])
  })

  it('a sync preventDefault runs before the listener returns; a non-bubbling event works', async () => {
    let entered = 0
    const { container } = await go(
      jsx('div', {
        children: [
          jsx('button', { onClick: (e: Event) => Effect.sync(() => e.preventDefault()) }),
          jsx('i', { onMouseenter: () => Effect.sync(() => entered++) }),
        ],
      }),
    )
    expect(click(container)).toBe(false)
    container.querySelector('i')!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
    expect(entered).toBe(1)
  })

  it('one listener across patches; the closure swaps; removing the prop removes the listener', async () => {
    const n = Atom.make(0)
    const log: Array<number> = []
    const add = vi.spyOn(HTMLElement.prototype, 'addEventListener')
    const P = () =>
      Effect.flatMap(useAtomValue(n), (v) =>
        jsx('button', v < 3 ? { onClick: () => Effect.sync(() => log.push(v)) } : {}),
      )
    const { container, store } = await go(jsx(P, {}))
    for (const v of [1, 2]) {
      store.set(n, v)
      await tick()
    }
    click(container)
    expect(add.mock.calls.filter(([t]) => t === 'click')).toHaveLength(1)
    store.set(n, 3)
    await tick()
    click(container)
    expect(log).toEqual([2])
    add.mockRestore()
  })

  it('failure, defect, sync throw and non-Effect return reach onError', async () => {
    const errors: Array<Cause.Cause<unknown>> = []
    const handlers = [
      () => Effect.fail(new Boom()),
      () => Effect.die('d'),
      () => {
        throw new Error('t')
      },
      () => 42,
    ]
    const { container } = await go(jsx('div', { children: handlers.map((h) => jsx('button', { onClick: h })) }), {
      onError: (c) => errors.push(c),
    })
    for (const b of container.querySelectorAll('button')) b.click()
    expect(errors).toHaveLength(4)
  })

  it('a handler may be a plain function, a generator or an Effect value; all run', async () => {
    const log: Array<string> = []
    const { container } = await go(
      jsx('div', {
        children: [
          jsx('button', { onClick: () => void log.push('plain') }),
          jsx('button', {
            onClick: function* () {
              yield* Effect.sync(() => log.push('gen'))
            },
          }),
          jsx('button', { onClick: Effect.sync(() => log.push('value')) }),
        ],
      }),
    )
    for (const b of container.querySelectorAll('button')) b.click()
    await tick()
    expect(log).toEqual(['plain', 'gen', 'value'])
  })

  describe('useEffect', () => {
    const Counter =
      (deps: (n: number) => ReadonlyArray<unknown> | undefined, log: Array<string>, n: Atom.Atom<number>) => () =>
        Effect.flatMap(useAtomValue(n), (v) =>
          Effect.as(
            useUiEffect(() => {
              log.push(`run${v}`)
              return () => log.push(`end${v}`)
            }, deps(v)),
            el('i', {}, String(v)),
          ),
        )

    it('[] runs once across re-runs and cleans up when the instance is removed', async () => {
      const n = Atom.make(0)
      const show = Atom.make(true)
      const log: Array<string> = []
      const P = () =>
        Effect.flatMap(useAtomValue(show), (s) =>
          jsx('div', {
            children: s
              ? jsx(
                  Counter(() => [], log, n),
                  {},
                )
              : null,
          }),
        )
      const { store } = await go(jsx(P, {}))
      store.set(n, 1)
      await tick()
      store.set(n, 2)
      await tick()
      expect(log).toEqual(['run0'])
      store.set(show, false)
      await tick()
      expect(log).toEqual(['run0', 'end0'])
    })

    it('re-runs, after the previous cleanup, when a dependency changes', async () => {
      const n = Atom.make(0)
      const log: Array<string> = []
      const { store, handle } = await go(
        jsx(
          Counter((v) => [Math.floor(v / 2)], log, n),
          {},
        ),
      )
      store.set(n, 1) // 0 -> 0: same
      await tick()
      store.set(n, 2) // 0 -> 1: changed
      await tick()
      expect(log).toEqual(['run0', 'end0', 'run2'])
      await act(() => handle.dispose())
      expect(log).toEqual(['run0', 'end0', 'run2', 'end2'])
    })

    it('without deps it runs on every run', async () => {
      const n = Atom.make(0)
      const log: Array<string> = []
      const { store } = await go(
        jsx(
          Counter(() => undefined, log, n),
          {},
        ),
      )
      store.set(n, 1)
      await tick()
      expect(log).toEqual(['run0', 'end0', 'run1'])
    })

    it('an Effect result gets the context and its own scope; it is interrupted on dispose', async () => {
      const log: Array<string> = []
      const C = () =>
        Effect.as(
          useUiEffect(
            () =>
              Effect.flatMap(Greeting, (g) =>
                Effect.zipRight(
                  Effect.addFinalizer(() => Effect.sync(() => log.push('finalized'))),
                  Effect.zipRight(
                    Effect.sync(() => log.push(g)),
                    Effect.never,
                  ),
                ),
              ),
            [],
          ),
          el('b', {}),
        )
      const { handle } = await go(jsx(C, {}), { layer: Layer.succeed(Greeting, 'hi') as any })
      await tick()
      expect(log).toEqual(['hi'])
      await act(() => handle.dispose())
      await tick()
      expect(log).toEqual(['hi', 'finalized'])
    })

    it('a throw, a failed Effect and a throwing cleanup reach onError', async () => {
      const errors: Array<Cause.Cause<unknown>> = []
      const A = () =>
        Effect.as(
          useUiEffect(() => {
            throw new Error('t')
          }, []),
          el('b', {}),
        )
      const B = () =>
        Effect.as(
          useUiEffect(() => Effect.fail(new Boom()), []),
          el('b', {}),
        )
      const D = () =>
        Effect.as(
          useUiEffect(
            () => () => {
              throw new Error('c')
            },
            [],
          ),
          el('b', {}),
        )
      const { handle } = await go(jsx('div', { children: [jsx(A, {}), jsx(B, {}), jsx(D, {})] }), {
        onError: (c) => errors.push(c),
      })
      await tick()
      await act(() => handle.dispose())
      expect(errors).toHaveLength(3)
    })

    it('does not run on the server', async () => {
      let ran = 0
      const C = () =>
        Effect.as(
          useUiEffect(() => void ran++, []),
          el('b', {}),
        )
      await renderToString(jsx(C, {}) as any, { layer: Layer.empty })
      expect(ran).toBe(0)
    })
  })

  it('in-flight fibers are interrupted on removal and dispose; no closure runs after dispose', async () => {
    const show = Atom.make(true)
    let interrupted = 0
    let ran = 0
    const slow = () => Effect.onInterrupt(Effect.never, () => Effect.sync(() => interrupted++))
    const P = () =>
      Effect.flatMap(useAtomValue(show), (s) =>
        jsx('div', {
          children: [
            s ? jsx('button', { onClick: slow }) : null,
            jsx('a', { onClick: () => Effect.sync(() => ran++).pipe(Effect.zipRight(slow())) }),
          ],
        }),
      )
    const { container, store, handle } = await go(jsx(P, {}))
    click(container)
    store.set(show, false)
    await tick()
    expect(interrupted).toBe(1)
    const a = container.querySelector('a')!
    a.click()
    await act(() => handle.dispose())
    await tick()
    expect(interrupted).toBe(2)
    a.click()
    expect(ran).toBe(1)
  })

  it('a bound atom child follows its atom without re-running the component; drop and swap release it', async () => {
    const mk = (key: string) => Atom.serializable(Atom.make(1), { key, schema: Schema.Number })
    const a = mk('a')
    const b = mk('b')
    const pick = Atom.make<'a' | 'b' | 'none'>('a')
    let runs = 0
    const P = () =>
      Effect.flatMap(useAtomValue(pick), (w) => (runs++, jsx('p', { children: w === 'a' ? a : w === 'b' ? b : null })))
    const store = counted()
    const { container } = await go(jsx(P, {}), { store })
    const text = () => container.querySelector('p')!.textContent
    expect(text()).toBe('1')
    store.set(a, 5)
    expect(text()).toBe('5')
    expect(runs).toBe(1)
    store.set(pick, 'b')
    await tick()
    expect(text()).toBe('1')
    expect(subs.get(a)).toBe(0)
    expect(subs.get(b)).toBe(1)
    store.set(b, 7)
    expect(text()).toBe('7')
    store.set(pick, 'none')
    await tick()
    expect(subs.get(b)).toBe(0)
  })
})

// ADR 0020: a keyed instance whose props and services are unchanged, and that read no atom, is not re-run.
describe('keyed instance reuse', () => {
  interface Item {
    id: number
    label: string
  }
  const mk = (ids: Array<number>): Array<Item> => ids.map((id) => ({ id, label: `L${id}` }))
  const rowsText = (c: HTMLElement) => [...c.querySelectorAll('li')].map((l) => l.textContent)
  // `list` is a parent that reads one atom of items and renders a keyed Row per item; `runs` counts Row runs.
  const setup = async (initial: Array<Item>, rowProps: (item: Item) => object = (item) => ({ item })) => {
    const items = Atom.make(initial)
    let runs = 0
    const Row = ({ item }: { item: Item }) => (runs++, jsx('li', { children: item.label }))
    const List = () =>
      Effect.flatMap(useAtomValue(items), (list) =>
        jsx('ul', { children: list.map((item) => jsx(Row, { ...rowProps(item), key: item.id })) }),
      )
    const t = await go(jsx(List, {}))
    return { ...t, items, runs: () => runs }
  }

  it('re-runs only the row whose item object changed', async () => {
    const list = mk([1, 2, 3])
    const { container, store, items, runs } = await setup(list)
    expect(runs()).toBe(3)
    store.set(items, [list[0]!, { id: 2, label: 'changed' }, list[2]!])
    await tick()
    expect(rowsText(container)).toEqual(['L1', 'changed', 'L3'])
    expect(runs()).toBe(4)
  })

  it('a row that reads an atom skips parent re-runs, still follows its atom, and drops its subscription and hold when removed', async () => {
    const list = mk([1, 2])
    const items = Atom.make(list)
    const tint = Atom.make('a')
    let runs = 0
    const Row = ({ item }: { item: Item }) =>
      Effect.flatMap(useAtomValue(tint), (t) => (runs++, jsx('li', { children: item.label + t })))
    const List = () =>
      Effect.flatMap(useAtomValue(items), (l) =>
        jsx('ul', { children: l.map((item) => jsx(Row, { item, key: item.id })) }),
      )
    const { container, store } = await go(jsx(List, {}), { store: counted() })
    expect(runs).toBe(2)
    store.set(items, [...list])
    await tick()
    expect(runs).toBe(2)
    expect(subs.get(tint)).toBe(2)
    store.set(tint, 'b')
    await tick()
    expect(rowsText(container)).toEqual(['L1b', 'L2b'])
    store.set(items, [list[0]!])
    await tick()
    expect(rowsText(container)).toEqual(['L1b'])
    expect(subs.get(tint)).toBe(1)
    store.set(items, [])
    await tick()
    expect(subs.get(tint)).toBe(0)
  })

  describe('host-only rows', () => {
    // A row that returns a bare host element is rebuilt from its props: unchanged output keeps the node, a fresh callback is just called.
    const rig = async (row: (p: { item: Item; label: (i: Item) => string }) => any) => {
      const list = mk([1, 2, 3])
      const items = Atom.make(list)
      const List = () =>
        Effect.flatMap(useAtomValue(items), (l) =>
          jsx('ul', { children: l.map((item) => jsx(row, { item, label: (i: Item) => i.label, key: item.id })) }),
        )
      const t = await go(jsx(List, {}))
      return { ...t, items, list }
    }

    it('a fresh render callback with the same output keeps every li, and a changed output updates only that li', async () => {
      let calls = 0
      const { container, store, items, list } = await rig(
        ({ item, label }) => (calls++, jsx('li', { children: label(item) })),
      )
      const lis = [...container.querySelectorAll('li')]
      calls = 0
      store.set(items, [...list])
      await tick()
      expect(calls).toBe(3)
      expect([...container.querySelectorAll('li')].every((l, i) => l === lis[i])).toBe(true)
      store.set(items, [list[0]!, { id: 2, label: 'changed' }, list[2]!])
      await tick()
      expect(rowsText(container)).toEqual(['L1', 'changed', 'L3'])
      expect([...container.querySelectorAll('li')].every((l, i) => l === lis[i])).toBe(true)
    })

    it('a nested host tree is built from its props: unchanged output keeps its nodes, a changed leaf updates', async () => {
      const { container, store, items, list } = await rig(({ item, label }) =>
        jsx('li', { className: 'r', children: [jsx('b', { children: label(item) }), jsx('i', { children: item.id })] }),
      )
      const bs = [...container.querySelectorAll('b')]
      store.set(items, [...list])
      await tick()
      expect([...container.querySelectorAll('b')].every((b, i) => b === bs[i])).toBe(true)
      store.set(items, [list[0]!, { id: 2, label: 'changed' }, list[2]!])
      await tick()
      expect([...container.querySelectorAll('li')].map((l) => l.textContent)).toEqual(['L11', 'changed2', 'L33'])
      expect(container.querySelectorAll('b')[0]).toBe(bs[0])
    })

    it('a nested child that is a component or an Effect falls back and still renders', async () => {
      const Leaf = () => jsx('u', { children: 'x' })
      const { container } = await rig(({ item }) =>
        jsx('li', { children: [jsx('b', { children: item.label }), jsx(Leaf, {})] }),
      )
      expect([...container.querySelectorAll('li')].map((l) => l.textContent)).toEqual(['L1x', 'L2x', 'L3x'])
    })

    it('a row that returns a nested component falls back to the normal path and still updates', async () => {
      const Leaf = ({ text }: { text: string }) => jsx('b', { children: text })
      const { container, store, items, list } = await rig(({ item, label }) =>
        jsx('li', { children: jsx(Leaf, { text: label(item) }) }),
      )
      store.set(items, [list[0]!, { id: 2, label: 'changed' }, list[2]!])
      await tick()
      expect(rowsText(container)).toEqual(['L1', 'changed', 'L3'])
    })

    it('a row with an event handler falls back and the click reaches it', async () => {
      const clicks: Array<number> = []
      const { container } = await rig(({ item }) =>
        jsx('li', { onClick: () => Effect.sync(() => void clicks.push(item.id)), children: item.label }),
      )
      container.querySelectorAll('li')[1]!.dispatchEvent(new Event('click', { bubbles: true }))
      await tick()
      expect(clicks).toEqual([2])
    })

    it('a row removed from the list leaves no li behind', async () => {
      const { container, store, items, list } = await rig(({ item, label }) => jsx('li', { children: label(item) }))
      store.set(items, [list[2]!, list[0]!])
      await tick()
      expect(rowsText(container)).toEqual(['L3', 'L1'])
    })
  })

  it('re-runs every row when a prop is a new function that is not an event handler', async () => {
    const list = mk([1, 2, 3])
    const { store, items, runs } = await setup(list, (item) => ({ item, format: () => item.id }))
    store.set(items, [...list])
    await tick()
    expect(runs()).toBe(6)
  })

  it('skips rows that take a fresh inline on* handler, and a click reaches the newest closure', async () => {
    const list = mk([1, 2])
    const items = Atom.make(list)
    const stamp = Atom.make(0)
    const picks: Array<string> = []
    let runs = 0
    const Row = ({ item, onPick }: { item: Item; onPick: () => Effect.Effect<void> }) => (
      runs++,
      jsx('li', { onClick: onPick, children: item.label })
    )
    const List = () =>
      Effect.flatMap(useAtomValue(items), (l) =>
        Effect.flatMap(useAtomValue(stamp), (st) =>
          jsx('ul', {
            children: l.map((item) =>
              jsx(Row, { item, onPick: () => Effect.sync(() => void picks.push(`${item.id}@${st}`)), key: item.id }),
            ),
          }),
        ),
      )
    const { container, store } = await go(jsx(List, {}))
    expect(runs).toBe(2)
    store.set(stamp, 1)
    await tick()
    expect(runs).toBe(2)
    await act(async () => container.querySelectorAll('li')[1]!.dispatchEvent(new Event('click', { bubbles: true })))
    expect(picks).toEqual(['2@1'])
  })

  it('does not remember a row that called its handler while rendering', async () => {
    const list = mk([1, 2])
    const items = Atom.make(list)
    let runs = 0
    const Row = ({ item, onFormat }: { item: Item; onFormat: () => string }) => (
      runs++,
      jsx('li', { children: onFormat() + item.label })
    )
    const List = () =>
      Effect.flatMap(useAtomValue(items), (l) =>
        jsx('ul', { children: l.map((item) => jsx(Row, { item, onFormat: () => 'x', key: item.id })) }),
      )
    const { store } = await go(jsx(List, {}))
    store.set(items, [...list])
    await tick()
    expect(runs).toBe(4)
  })

  it('does not see an item mutated in place', async () => {
    const list = mk([1, 2])
    const { container, store, items, runs } = await setup(list)
    list[0]!.label = 'mutated'
    store.set(items, [...list])
    await tick()
    expect(rowsText(container)).toEqual(['L1', 'L2'])
    expect(runs()).toBe(2)
  })

  it('reorders without re-running, and a removed then re-added key runs fresh', async () => {
    const list = mk([1, 2, 3])
    const { container, store, items, runs } = await setup(list)
    store.set(items, [list[2]!, list[0]!, list[1]!])
    await tick()
    expect(rowsText(container)).toEqual(['L3', 'L1', 'L2'])
    expect(runs()).toBe(3)
    store.set(items, [list[2]!, list[1]!])
    await tick()
    expect(rowsText(container)).toEqual(['L3', 'L2'])
    store.set(items, [list[2]!, list[0]!, list[1]!])
    await tick()
    expect(rowsText(container)).toEqual(['L3', 'L1', 'L2'])
    expect(runs()).toBe(4)
  })

  it("keeps a skipped row's local state, and a row that reads atoms keeps updating", async () => {
    const list = mk([1, 2])
    const items = Atom.make(list)
    const count = Atom.make(0)
    let runs = 0
    const Row = ({ item }: { item: Item }) =>
      Effect.flatMap(useLocal(0), ([n, set]) =>
        Effect.flatMap(
          useAtomValue(count),
          (c) => (
            runs++,
            jsx('li', { onClick: () => Effect.sync(() => set(n + 1)), children: `${item.label}:${n}:${c}` })
          ),
        ),
      )
    const List = () =>
      Effect.flatMap(useAtomValue(items), (l) =>
        jsx('ul', { children: l.map((item) => jsx(Row, { item, key: item.id })) }),
      )
    const { container, store } = await go(jsx(List, {}))
    const text = () => rowsText(container)
    await act(async () => container.querySelectorAll('li')[0]!.dispatchEvent(new Event('click', { bubbles: true })))
    await tick()
    expect(text()).toEqual(['L1:1:0', 'L2:0:0'])
    store.set(items, [...list])
    await tick()
    expect(text()).toEqual(['L1:1:0', 'L2:0:0'])
    store.set(count, 5)
    await tick()
    expect(text()).toEqual(['L1:1:5', 'L2:0:5'])
    expect(runs).toBeGreaterThan(2)
  })

  it('re-runs rows when a Provider above them changes a service', async () => {
    const g = Atom.make('a')
    const list = mk([1, 2])
    let runs = 0
    const Row = ({ item }: { item: Item }) =>
      Effect.flatMap(Greeting, (hi) => (runs++, jsx('li', { children: `${hi}${item.id}` })))
    const List = () =>
      Effect.flatMap(useAtomValue(g), (v) =>
        jsx(Provider, {
          layer: Layer.succeed(Greeting, v),
          children: jsx('ul', { children: list.map((item) => jsx(Row, { item, key: item.id })) }),
        }),
      )
    const { container, store } = await go(jsx(List, {}))
    expect(rowsText(container)).toEqual(['a1', 'a2'])
    store.set(g, 'a')
    await tick()
    expect(runs).toBe(2)
    store.set(g, 'b')
    await tick()
    expect(rowsText(container)).toEqual(['b1', 'b2'])
    expect(runs).toBe(4)
  })
})

describe('atom bindings in JSX', () => {
  it('a derived atom as a child and an atom as an attribute follow the atom without re-running the component', async () => {
    const count = Atom.make(1)
    const label = Atom.make((get) => `n=${get(count) * 2}`)
    const cls = Atom.make('a')
    let runs = 0
    const View = () => (runs++, jsx('p', { className: cls, 'data-n': count, children: ['x ', label] }))
    const { container, store } = await go(jsx(View, {}), { store: counted() })
    const p = container.querySelector('p')!
    expect(p.outerHTML).toBe('<p class="a" data-n="1">x n=2</p>')
    store.set(count, 5)
    store.set(cls, 'b')
    await tick()
    expect(container.querySelector('p')).toBe(p)
    expect(p.outerHTML).toBe('<p class="b" data-n="5">x n=10</p>')
    expect(runs).toBe(1)
  })

  it('false and null drop the attribute; true sets it empty', async () => {
    const flag = Atom.make<boolean | null>(true)
    const { container, store } = await go(jsx('input', { disabled: flag }))
    const input = container.querySelector('input')!
    expect(input.getAttribute('disabled')).toBe('')
    store.set(flag, false)
    await tick()
    expect(input.hasAttribute('disabled')).toBe(false)
    store.set(flag, null)
    await tick()
    expect(input.hasAttribute('disabled')).toBe(false)
  })

  it('a form value follows its atom', async () => {
    const v = Atom.make('a')
    const { container, store } = await go(jsx('input', { value: v }))
    const input = container.querySelector('input')!
    expect(input.value).toBe('a')
    store.set(v, 'b')
    await tick()
    expect(input.value).toBe('b')
  })

  it('a parent re-run that swaps the atom re-points the binding, and dropping the element releases it', async () => {
    const which = Atom.make(true)
    const a = Atom.make('A')
    const b = Atom.make('B')
    const Same = () => Effect.flatMap(useAtomValue(which), (w) => jsx('span', { title: w ? a : b }))
    const { container, store } = await go(jsx(Same, {}), { store: counted() })
    const span = container.querySelector('span')!
    expect(span.title).toBe('A')
    expect(subs.get(a)).toBe(1)
    store.set(which, false)
    await tick()
    expect(container.querySelector('span')).toBe(span)
    expect(span.title).toBe('B')
    expect(subs.get(a) ?? 0).toBe(0)
    expect(subs.get(b)).toBe(1)
    store.set(a, 'A2')
    store.set(b, 'B2')
    await tick()
    expect(span.title).toBe('B2')
  })

  it('renderToString renders the current values', async () => {
    const x = Atom.make((_get) => 'v')
    const html = await renderToString(jsx('p', { title: x, children: x }), { layer: Layer.empty })
    expect(html).toContain('<p title="v">v</p>')
  })
})

describe('unkeyed host rows', () => {
  interface Item {
    id: number
    label: string
  }
  const lis = (c: HTMLElement) => [...c.querySelectorAll('li')]

  it('an unchanged row is not re-run and keeps its li; a changed row rebuilds only itself', async () => {
    const list: Array<Item> = [1, 2, 3].map((id) => ({ id, label: `L${id}` }))
    const items = Atom.make(list)
    let runs = 0
    const Row = ({ item }: { item: Item }) => (runs++, jsx('li', { children: [jsx('b', { children: item.label })] }))
    const List = () =>
      Effect.flatMap(useAtomValue(items), (l) => jsx('ul', { children: l.map((item) => jsx(Row, { item })) }))
    const { container, store } = await go(jsx(List, {}))
    const before = lis(container)
    expect(runs).toBe(3)
    store.set(items, [...list])
    await tick()
    expect(runs).toBe(3)
    expect(lis(container).every((l, i) => l === before[i])).toBe(true)
    store.set(items, [list[0]!, { id: 2, label: 'changed' }, list[2]!])
    await tick()
    expect(lis(container).map((l) => l.textContent)).toEqual(['L1', 'changed', 'L3'])
    expect(runs).toBe(4)
    expect(lis(container).every((l, i) => l === before[i])).toBe(true)
  })

  it('renderToString renders unkeyed host rows with nested elements', async () => {
    const Row = ({ n }: { n: number }) => jsx('li', { className: 'r', children: [jsx('b', { children: `n${n}` }), n] })
    const html = await renderToString(jsx('ul', { children: [1, 2].map((n) => jsx(Row, { n })) }), {
      layer: Layer.empty,
    })
    expect(html).toBe('<ul><li class="r"><b>n1</b>1</li><li class="r"><b>n2</b>2</li></ul>')
  })

  it('a row that had local state and drops it still reports a slot mismatch', async () => {
    const withState = Atom.make(true)
    const Row = ({ on }: { on: boolean }) =>
      on ? Effect.flatMap(useLocal(0), ([n]) => jsx('li', { children: String(n) })) : jsx('li', { children: 'plain' })
    const List = () => Effect.flatMap(useAtomValue(withState), (on) => jsx('ul', { children: jsx(Row, { on }) }))
    const onError = vi.fn()
    const { container, store } = await go(jsx(List, {}), { onError })
    expect(container.textContent).toBe('0')
    store.set(withState, false)
    await tick()
    expect(onError).toHaveBeenCalled()
    expect(JSON.stringify(onError.mock.calls[0]![0])).toContain('SlotMismatch')
  })

  it('an unkeyed row with a hook and a nested component still renders and updates', async () => {
    const tint = Atom.make('a')
    const Leaf = () => jsx('u', { children: 'x' })
    const Row = () => Effect.flatMap(useAtomValue(tint), (t) => jsx('li', { children: [t, jsx(Leaf, {})] }))
    const { container, store } = await go(jsx('ul', { children: [jsx(Row, {}), jsx(Row, {})] }))
    expect(container.textContent).toBe('axax')
    store.set(tint, 'b')
    await tick()
    expect(container.textContent).toBe('bxbx')
  })
})

describe('eager host elements', () => {
  it('a plain host tree is the same node on every run and renders like a lazy one', async () => {
    const tree = jsx('p', { className: 'a', children: ['x', 1, jsx('b', { children: 'y' })] })
    const first = Effect.runSync(tree as any)
    expect(Effect.runSync(tree as any)).toBe(first)
    expect(first).toEqual(el('p', { class: 'a' }, 'x', '1', el('b', {}, 'y')))
    const html = await renderToString(tree, { layer: Layer.empty })
    expect(html).toBe('<p class="a">x<!--sleek-t-->1<b>y</b></p>')
  })

  it('an element with an event, an atom or a component child still runs lazily and keeps them', async () => {
    const clicks: Array<string> = []
    const label = Atom.make('L')
    const Leaf = () => jsx('u', { children: 'leaf' })
    const { container } = await go(
      jsx('div', {
        children: [
          jsx('button', { onClick: () => Effect.sync(() => void clicks.push('c')), children: 'go' }),
          jsx('i', { title: label, children: label }),
          jsx('p', { children: jsx(Leaf, {}) }),
        ],
      }),
    )
    expect(container.innerHTML).toBe('<div><button>go</button><i title="L">L</i><p><u>leaf</u></p></div>')
    container.querySelector('button')!.dispatchEvent(new Event('click', { bubbles: true }))
    await tick()
    expect(clicks).toEqual(['c'])
  })

  it('an element key survives, including when a keyed row returns a keyed host element', async () => {
    const order = Atom.make([1, 2, 3])
    const Row = ({ n }: { n: number }) => jsx('li', { key: `own${n}`, children: String(n) })
    const List = () =>
      Effect.flatMap(useAtomValue(order), (l) => jsx('ul', { children: l.map((n) => jsx(Row, { n, key: n })) }))
    const { container, store } = await go(jsx(List, {}))
    const lis = [...container.querySelectorAll('li')]
    store.set(order, [3, 1, 2])
    await tick()
    expect([...container.querySelectorAll('li')].map((l) => l.textContent)).toEqual(['3', '1', '2'])
    expect(new Set([...container.querySelectorAll('li')])).toEqual(new Set(lis))
  })
})

describe('lazy element children', () => {
  it('keeps the order of text, atoms and component children, with none, one or several components', async () => {
    const A = () => jsx('u', { children: 'A' })
    const B = () => jsx('s', { children: 'B' })
    const at = Atom.make('@')
    const none = await renderToString(jsx('p', { children: ['a', 1, null, false, 'b'] }), { layer: Layer.empty })
    const one = await renderToString(jsx('p', { children: ['a', jsx(A, {}), 'b'] }), { layer: Layer.empty })
    const many = await renderToString(jsx('p', { children: ['x', jsx(A, {}), 'y', at, jsx(B, {}), 'z'] }), {
      layer: Layer.empty,
    })
    expect(none).toBe('<p>a<!--sleek-t-->1<!--sleek-t-->b</p>')
    expect(one).toBe('<p>a<u>A</u>b</p>')
    expect(many).toBe('<p>x<u>A</u>y<!--sleek-t-->@<s>B</s>z</p>')
  })
})
