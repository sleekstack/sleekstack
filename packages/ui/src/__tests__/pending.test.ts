// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import { QueryClientLive } from '@sleekstack/query'
import type { QueryClient } from '@tanstack/query-core'
import { Cause, Data, Effect, Layer, Scope } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Boundary, el, mount, type Mounted, Pending, useAtomValue, useLocal } from '../index'
import { useQuery, useQueryClient } from '../query'
import { jsx as rawJsx } from '../jsx-runtime'
import { RenderScope as Scoped } from '../reactive'

const jsx = (type: any, props: any, key?: string) => rawJsx(type, props, key)
const tick = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))

// A promise the test settles.
const gate = () => {
  let open!: () => void
  const promise = new Promise<void>((r) => (open = r))
  return { promise, open: () => act(async () => (open(), await new Promise((r) => setTimeout(r, 0)))) }
}

// Registers a finalizer on the running RenderScope; flips `flag.closed` when that scope closes.
const onClose = (flag: { closed: boolean }) =>
  Effect.flatMap(Scoped, (s) => (s ? Scope.addFinalizer(s, Effect.sync(() => void (flag.closed = true))) : Effect.void))

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
const go = async (app: any, layer: unknown = Layer.empty) => {
  const container = document.createElement('div')
  const store = makeAtomStore()
  const errors: Array<Cause.Cause<unknown>> = []
  await act(async () => void handles.push(await mount(app, { layer, container, store, onError: (c: Cause.Cause<unknown>) => errors.push(c) } as any)))
  return { container, store, errors }
}

class Boom extends Data.TaggedError('Boom')<{}> {}

// Content reading query `key` (resolved at once) after waiting on `wait`; `client` and `observers()` inspect the cache.
const queried = (key: string) => {
  let client: QueryClient | undefined
  const Q = () =>
    Effect.flatMap(useQueryClient(), (c) => ((client = c), Effect.map(useQuery({ queryKey: [key], queryFn: async () => 'q', retry: false }), (r) => el('b', {}, r.data ?? '-'))))
  const observers = () => client?.getQueryCache().find({ queryKey: [key] })?.getObserversCount() ?? 0
  return { Q, observers }
}

describe('Pending', () => {
  it('renders fallback first, then content in the same place; the slot-set re-run does not fork or close content scopes', async () => {
    const g = gate()
    let forks = 0
    const fallbackScope = { closed: false }
    const contentScope = { closed: false }
    const Fallback = () => Effect.as(onClose(fallbackScope), el('i', {}, 'loading'))
    const Slow = () => Effect.as(Effect.zipRight(onClose(contentScope), Effect.promise(() => g.promise)), el('b', {}, 'done'))
    const content = Effect.suspend(() => (forks++, jsx(Slow, {})))
    const { container } = await go(jsx('section', { children: [jsx('hr', {}), jsx(Pending, { fallback: jsx(Fallback, {}), children: content }), jsx('br', {})] }))
    expect(container.innerHTML.replace(/<sleek-reactive[^>]*>|<\/sleek-reactive>/g, '')).toBe('<section><hr><i>loading</i><br></section>')
    await g.open()
    await tick()
    expect(container.innerHTML.replace(/<sleek-reactive[^>]*>|<\/sleek-reactive>/g, '')).toBe('<section><hr><b>done</b><br></section>')
    expect(forks).toBe(1)
    expect(contentScope.closed).toBe(false)
    expect(fallbackScope.closed).toBe(true)
  })

  it('is a Reactive instance with no key and no reads, and accepts a key', async () => {
    const { container } = await go(jsx('div', { children: [jsx(Pending, { fallback: 'a' }), jsx(Pending, { fallback: 'b' }, 'k')] }))
    await tick()
    expect(container.querySelectorAll('sleek-reactive').length).toBe(2)
  })

  it('keeps nested useLocal state under content across a parent re-run', async () => {
    const parent = Atom.make(0)
    const gates = [gate(), gate()]
    let forks = 0
    let setCount!: (n: number) => void
    const Counter = () => Effect.map(useLocal(0), ([n, set]) => ((setCount = set), el('b', {}, String(n))))
    const Parent = () =>
      Effect.flatMap(useAtomValue(parent), (p) =>
        jsx('section', {
          children: [jsx('i', { children: String(p) }), jsx(Pending, { fallback: 'loading', children: Effect.suspend(() => Effect.zipRight(Effect.promise(() => gates[forks++]!.promise), jsx(Counter, {}))) })],
        }),
      )
    const { container, store } = await go(jsx(Parent, {}))
    expect(container.textContent).toBe('0loading')
    await gates[0]!.open()
    await tick()
    setCount(5)
    await tick()
    expect(container.textContent).toBe('05')
    store.set(parent, 1)
    await tick()
    // Re-forked; the previous content stays on screen meanwhile.
    expect(forks).toBe(2)
    expect(container.textContent).toBe('15')
    await gates[1]!.open()
    await tick()
    expect(container.textContent).toBe('15')
  })

  it('R2: a re-run keeps the old content (never the fallback); its observer is retained until the new content commits', async () => {
    const parent = Atom.make(0)
    const gates = [gate(), gate()]
    let forks = 0
    const { Q, observers } = queried('r2')
    const Parent = () =>
      Effect.flatMap(useAtomValue(parent), (p) =>
        jsx('div', { children: [String(p), jsx(Pending, { fallback: 'loading', children: Effect.suspend(() => Effect.zipRight(Effect.promise(() => gates[forks++]!.promise), jsx(Q, {}))) })] }),
      )
    const { container, store } = await go(jsx(Parent, {}), QueryClientLive())
    await gates[0]!.open()
    await tick()
    expect(container.textContent).toBe('0q')
    expect(observers()).toBe(1)
    store.set(parent, 1)
    await tick()
    expect(container.textContent).toBe('1q')
    expect(observers()).toBe(1)
    await gates[1]!.open()
    await tick()
    expect(container.textContent).toBe('1q')
    // The old observer released at commit; only the new content's remains.
    expect(observers()).toBe(1)
    expect(forks).toBe(2)
  })

  it('R1: a content failure renders the nearest Boundary fallback', async () => {
    const tree = jsx(Boundary, { tag: 'Boom', fallback: () => Effect.succeed(el('p', {}, 'caught')), children: jsx(Pending, { fallback: 'loading', children: Effect.fail(new Boom()) }) })
    const { container, errors } = await go(tree)
    await tick()
    expect(container.textContent).toBe('caught')
    expect(errors).toEqual([])
  })

  it('R1: a content failure with no Boundary reports to onError and leaves the fallback showing', async () => {
    const { container, errors } = await go(jsx(Pending, { fallback: 'loading', children: Effect.fail(new Boom()) }))
    await tick()
    expect(container.textContent).toBe('loading')
    expect(errors.length).toBe(1)
    expect(Cause.squash(errors[0]!)).toBeInstanceOf(Boom)
  })

  it('R2: a failed re-run keeps the old content and reports', async () => {
    const parent = Atom.make(0)
    const Parent = () =>
      Effect.flatMap(useAtomValue(parent), (p) => jsx(Pending, { fallback: 'loading', children: p === 0 ? Effect.succeed(el('b', {}, 'ok')) : Effect.fail(new Boom()) }))
    const { container, store, errors } = await go(jsx(Parent, {}))
    await tick()
    expect(container.textContent).toBe('ok')
    store.set(parent, 1)
    await tick()
    expect(container.textContent).toBe('ok')
    expect(errors.length).toBe(1)
  })

  it.each(['unmount', 'supersede'])('R3: %s while pending interrupts the fiber, closes scopes and leaks no observer', async (how) => {
    const show = Atom.make(0)
    const gates = [gate(), gate()]
    let forks = 0
    const interrupted: Array<number> = []
    const scope = { closed: false }
    const { Q, observers } = queried(`r3-${how}`)
    // The first fork subscribes its observer, then waits; later forks resolve once their gate opens.
    const content = Effect.suspend(() => {
      const n = forks++
      const wait = Effect.onInterrupt(Effect.promise(() => gates[n]!.promise), () => Effect.sync(() => void interrupted.push(n)))
      return n === 0 ? Effect.zipRight(onClose(scope), jsx('div', { children: [jsx(Q, {}), Effect.zipRight(wait, Effect.succeed(el('i', {}, 'x')))] })) : Effect.zipRight(wait, Effect.succeed(el('b', {}, 'new')))
    })
    const Parent = () => Effect.flatMap(useAtomValue(show), (s) => (s === 1 && how === 'unmount' ? Effect.succeed(el('p', {}, 'off')) : jsx(Pending, { fallback: `loading${s}`, children: content })))
    const { container, store } = await go(jsx(Parent, {}), QueryClientLive())
    await tick()
    expect(observers()).toBe(1)
    store.set(show, 1)
    await tick()
    expect(interrupted).toEqual([0])
    expect(scope.closed).toBe(true)
    expect(observers()).toBe(0)
    // Latest wins: the stale gate opening writes nothing.
    await gates[0]!.open()
    expect(container.textContent).toBe(how === 'unmount' ? 'off' : 'loading1')
    if (how === 'supersede') {
      await gates[1]!.open()
      await tick()
      expect(container.textContent).toBe('new')
    }
  })

  it('nested: the innermost Pending wins and the outer content does not wait on it', async () => {
    const g = gate()
    const inner = jsx(Pending, { fallback: 'inner-loading', children: Effect.zipRight(Effect.promise(() => g.promise), Effect.succeed(el('b', {}, 'deep'))) })
    const { container } = await go(jsx(Pending, { fallback: 'outer-loading', children: jsx('div', { children: ['outer:', inner] }) }))
    await tick()
    expect(container.textContent).toBe('outer:inner-loading')
    await g.open()
    await tick()
    expect(container.textContent).toBe('outer:deep')
  })

  it('nested: an instance under content re-running on its own with suspending work awaits in its own re-run, never showing the fallback', async () => {
    const a = Atom.make(0)
    const gates = [gate(), gate()]
    let runs = 0
    const Child = () => Effect.flatMap(useAtomValue(a), (n) => Effect.as(Effect.promise(() => gates[runs++]!.promise), el('b', {}, String(n))))
    const { container, store } = await go(jsx(Pending, { fallback: 'loading', children: jsx(Child, {}) }))
    await gates[0]!.open()
    await tick()
    expect(container.textContent).toBe('0')
    store.set(a, 1)
    await tick()
    expect(container.textContent).toBe('0')
    await gates[1]!.open()
    await tick()
    expect(container.textContent).toBe('1')
  })

  it('keyed: a key change is a new instance with a fresh fiber; the old content scope closes', async () => {
    const k = Atom.make('a')
    const gates = [gate(), gate()]
    let forks = 0
    const scopes = [{ closed: false }, { closed: false }]
    const content = Effect.suspend(() => {
      const n = forks++
      return Effect.zipRight(Effect.zipRight(onClose(scopes[n]!), Effect.promise(() => gates[n]!.promise)), Effect.succeed(el('b', {}, `c${n}`)))
    })
    const Parent = () => Effect.flatMap(useAtomValue(k), (key) => jsx('div', { children: [jsx(Pending, { fallback: 'loading', children: content }, key)] }))
    const { container, store } = await go(jsx(Parent, {}))
    await gates[0]!.open()
    await tick()
    expect(container.textContent).toBe('c0')
    store.set(k, 'b')
    await tick()
    expect(container.textContent).toBe('loading')
    expect(scopes[0]!.closed).toBe(true)
    await gates[1]!.open()
    await tick()
    expect(container.textContent).toBe('c1')
    expect(forks).toBe(2)
  })
})
