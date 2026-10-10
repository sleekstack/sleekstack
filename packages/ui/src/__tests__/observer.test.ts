// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import { Effect, Layer } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  el,
  hydrateMount,
  mount,
  type Mounted,
  type RenderEvent,
  renderToString,
  useAtomValue,
  useEffect,
  useLocal,
} from '../index'
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

const a = Atom.make(1)
const b = Atom.make(1)
const show = Atom.make(true)
const Leaf = () =>
  Effect.gen(function* () {
    const [n] = yield* useLocal(0)
    const x = yield* useAtomValue(a)
    const y = yield* useAtomValue(b)
    return el('i', {}, `${n}${x}${y}`)
  })
const Root = () =>
  Effect.flatMap(useAtomValue(show), (on) => jsx('div', { children: on ? jsx(Leaf, { key: 'k' }) : null }))

const observed = async (app: unknown, store = makeAtomStore()) => {
  const events: Array<RenderEvent> = []
  const container = document.createElement('div')
  await act(
    async () =>
      void handles.push(
        await mount(app as any, { layer: Layer.empty, container, store, observe: (e) => events.push(e) }),
      ),
  )
  return { events, store, container }
}

describe('render observer', () => {
  it('reports create with slots, a coalesced re-run with every cause, and dispose; events are plain data', async () => {
    const { events, store, container } = await observed(jsx(Root, {}))
    const html = container.innerHTML
    const [root, leaf] = events.filter((e) => e.type === 'create') as Array<Extract<RenderEvent, { path: string }>>
    expect(leaf).toMatchObject({ parent: root!.instance, key: 'k' })
    expect(events.find((e) => e.type === 'slot')).toMatchObject({ instance: leaf!.instance, index: 0 })

    events.length = 0
    store.batch(() => (store.set(a, 2), store.set(b, 2)))
    await tick()
    expect(events).toEqual([
      {
        type: 'rerun',
        mount: leaf!.mount,
        instance: leaf!.instance,
        reasons: [
          { cause: 'atom', atom: a.label },
          { cause: 'atom', atom: b.label },
        ],
      },
    ])

    store.set(show, false)
    await tick()
    expect(events.at(-1)).toEqual({ type: 'dispose', mount: leaf!.mount, instance: leaf!.instance })
    // No function or live object rides on an event: each survives a structured clone unchanged.
    expect(structuredClone(events)).toEqual(events)
    expect(html).toBe(
      '<sleek-reactive style="display: contents;"><div><sleek-reactive style="display: contents;"><i>011</i></sleek-reactive></div></sleek-reactive>',
    )
  })

  it('names a parent re-run as the reason for a child the parent ran again', async () => {
    const p = Atom.make(0)
    const Child = (props: { n: number }) => Effect.map(useAtomValue(a), (x) => el('b', {}, `${props.n}${x}`))
    const Parent = () => Effect.flatMap(useAtomValue(p), (n) => jsx('div', { children: jsx(Child, { n }) }))
    const { events, store } = await observed(jsx(Parent, {}))
    const child = events.filter((e) => e.type === 'create')[1]!
    events.length = 0
    store.set(p, 1)
    await tick()
    expect(events).toContainEqual({
      type: 'rerun',
      mount: child.mount,
      instance: child.instance,
      reasons: [{ cause: 'parent' }],
    })
  })

  it('drops the causes of a re-run a parent commit superseded', async () => {
    const p = Atom.make(0)
    const x = Atom.make(0)
    const y = Atom.make(0)
    const Child = (props: { n: number }) =>
      Effect.map(useAtomValue(props.n === 0 ? x : y), (v) => el('b', {}, `${props.n}${v}`))
    const Parent = () => Effect.flatMap(useAtomValue(p), (n) => jsx('div', { children: jsx(Child, { n }) }))
    const { events, store } = await observed(jsx(Parent, {}))
    const child = events.filter((e) => e.type === 'create')[1]!
    store.set(p, 1)
    store.set(x, 1)
    await tick()
    events.length = 0
    store.set(y, 1)
    await tick()
    expect(events).toEqual([
      { type: 'rerun', mount: child.mount, instance: child.instance, reasons: [{ cause: 'atom', atom: y.label }] },
    ])
  })

  it('stamps each mount with its own id', async () => {
    const one = await observed(jsx(Leaf, {}))
    const two = await observed(jsx(Leaf, {}))
    expect(one.events[0]!.mount).not.toBe(two.events[0]!.mount)
  })

  it('reports hydrated instances as adopt, not create', async () => {
    const container = document.createElement('div')
    container.innerHTML = await renderToString(jsx(Leaf, {}), { layer: Layer.empty })
    const events: Array<RenderEvent> = []
    await act(
      async () =>
        void handles.push(
          await hydrateMount(jsx(Leaf, {}), { layer: Layer.empty, container, observe: (e) => events.push(e) }),
        ),
    )
    expect(events.map((e) => e.type)).toEqual(['adopt', 'slot'])
  })

  it('reports effect start, restart and cleanup with the instance id', async () => {
    const dep = Atom.make(0)
    const Fx = () =>
      Effect.gen(function* () {
        const d = yield* useAtomValue(dep)
        yield* useEffect(() => () => {}, [d])
        yield* useEffect(function* () {
          yield* useAtomValue(a)
        })
        return el('i', {}, 'x')
      })
    const App = () =>
      Effect.flatMap(useAtomValue(show), (on) => jsx('div', { children: on ? jsx(Fx, { key: 'f' }) : null }))
    const store = makeAtomStore()
    store.set(show, true)
    const { events } = await observed(jsx(App, {}), store)
    const fx = () => events.flatMap((e) => (e.type === 'effect' ? [`${e.phase}:${e.index}`] : []))
    const id = events.find((e) => e.type === 'create' && e.path.includes(':key:f'))!.instance
    await tick()
    expect(fx()).toEqual(['start:0', 'start:1'])
    expect(events.filter((e) => e.type === 'effect').every((e) => e.instance === id && e.mount > 0)).toBe(true)
    await act(async () => store.set(a, 5))
    await tick()
    await act(async () => store.set(dep, 1))
    await tick()
    await act(async () => store.set(show, false))
    await tick()
    expect(fx().slice(2)).toEqual(['restart:1', 'cleanup:0', 'start:0', 'cleanup:0', 'cleanup:1'])
  })
})
