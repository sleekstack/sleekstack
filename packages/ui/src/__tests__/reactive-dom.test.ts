// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import { Context, Data, Deferred, Effect, Layer } from 'effect'
import { act, createElement } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Boundary, el, fromReact, mount, type Mounted, Provider, Store, useAtomValue, useSetAtom } from '../index'
import { jsx as rawJsx } from '../jsx-runtime'

const jsx = (type: any, props: any) => rawJsx(type, props)
const tick = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))

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

  it('nested: inner change touches only the inner host; outer change recreates inner subscriptions', async () => {
    const outer = Atom.make('o1')
    const inner = Atom.make('i1')
    const Inner = () => Effect.map(useAtomValue(inner), (v) => el('em', {}, v))
    const Outer = () => Effect.flatMap(useAtomValue(outer), (v) => Effect.map(jsx(Inner, {}), (i) => el('div', {}, el('span', {}, v), i)))
    const { container, store } = await go(jsx(Outer, {}))
    const span = container.querySelector('span')
    store.set(inner, 'i2')
    await tick()
    expect(container.querySelector('em')!.textContent).toBe('i2')
    expect(container.querySelector('span')).toBe(span)
    store.set(outer, 'o2')
    await tick()
    expect(container.querySelector('span')).not.toBe(span)
    store.set(inner, 'i3')
    await tick()
    expect(container.textContent).toBe('o2i3')
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
