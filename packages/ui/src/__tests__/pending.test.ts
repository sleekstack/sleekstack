// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import { Effect, Layer, Scope } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { el, mount, type Mounted, Pending, useAtomValue, useLocal } from '../index'
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
const go = async (app: any) => {
  const container = document.createElement('div')
  const store = makeAtomStore()
  await act(async () => void handles.push(await mount(app, { layer: Layer.empty, container, store } as any)))
  return { container, store }
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
})
