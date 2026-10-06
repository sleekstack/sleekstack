// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import { Cause, Data, Effect, Layer, Scope } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Boundary, el, mount, type Mounted, Pending, useAtomValue, useLocal } from '../index'
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
  Effect.flatMap(Scoped, (s) =>
    s
      ? Scope.addFinalizer(
          s,
          Effect.sync(() => void (flag.closed = true)),
        )
      : Effect.void,
  )

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
  await act(
    async () =>
      void handles.push(
        await mount(app, { layer, container, store, onError: (c: Cause.Cause<unknown>) => errors.push(c) } as any),
      ),
  )
  return { container, store, errors }
}

class Boom extends Data.TaggedError('Boom')<{}> {}

describe('Pending', () => {
  it('renders fallback first, then content in the same place; the slot-set re-run does not fork or close content scopes', async () => {
    const g = gate()
    let forks = 0
    const fallbackScope = { closed: false }
    const contentScope = { closed: false }
    const Fallback = () => Effect.as(onClose(fallbackScope), el('i', {}, 'loading'))
    const Slow = () =>
      Effect.as(
        Effect.zipRight(
          onClose(contentScope),
          Effect.promise(() => g.promise),
        ),
        el('b', {}, 'done'),
      )
    const content = Effect.suspend(() => (forks++, jsx(Slow, {})))
    const { container } = await go(
      jsx('section', {
        children: [jsx('hr', {}), jsx(Pending, { fallback: jsx(Fallback, {}), children: content }), jsx('br', {})],
      }),
    )
    expect(container.innerHTML.replace(/<sleek-reactive[^>]*>|<\/sleek-reactive>/g, '')).toBe(
      '<section><hr><i>loading</i><br></section>',
    )
    await g.open()
    await tick()
    expect(container.innerHTML.replace(/<sleek-reactive[^>]*>|<\/sleek-reactive>/g, '')).toBe(
      '<section><hr><b>done</b><br></section>',
    )
    expect(forks).toBe(1)
    expect(contentScope.closed).toBe(false)
    expect(fallbackScope.closed).toBe(true)
  })

  it('is a Reactive instance with no key and no reads, and accepts a key', async () => {
    const { container } = await go(
      jsx('div', { children: [jsx(Pending, { fallback: 'a' }), jsx(Pending, { fallback: 'b' }, 'k')] }),
    )
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
          children: [
            jsx('i', { children: String(p) }),
            jsx(Pending, {
              fallback: 'loading',
              children: Effect.suspend(() =>
                Effect.zipRight(
                  Effect.promise(() => gates[forks++]!.promise),
                  jsx(Counter, {}),
                ),
              ),
            }),
          ],
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

  it('R1: a content failure renders the nearest Boundary fallback', async () => {
    const tree = jsx(Boundary, {
      tag: 'Boom',
      fallback: () => Effect.succeed(el('p', {}, 'caught')),
      children: jsx(Pending, { fallback: 'loading', children: Effect.fail(new Boom()) }),
    })
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

  it('nested: the innermost Pending wins and the outer content does not wait on it', async () => {
    const g = gate()
    const inner = jsx(Pending, {
      fallback: 'inner-loading',
      children: Effect.zipRight(
        Effect.promise(() => g.promise),
        Effect.succeed(el('b', {}, 'deep')),
      ),
    })
    const { container } = await go(
      jsx(Pending, { fallback: 'outer-loading', children: jsx('div', { children: ['outer:', inner] }) }),
    )
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
    const Child = () =>
      Effect.flatMap(useAtomValue(a), (n) =>
        Effect.as(
          Effect.promise(() => gates[runs++]!.promise),
          el('b', {}, String(n)),
        ),
      )
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
      return Effect.zipRight(
        Effect.zipRight(
          onClose(scopes[n]!),
          Effect.promise(() => gates[n]!.promise),
        ),
        Effect.succeed(el('b', {}, `c${n}`)),
      )
    })
    const Parent = () =>
      Effect.flatMap(useAtomValue(k), (key) =>
        jsx('div', { children: [jsx(Pending, { fallback: 'loading', children: content }, key)] }),
      )
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
