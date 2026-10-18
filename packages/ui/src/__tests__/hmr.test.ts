// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import { Cause, Effect, Layer } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { el, mount, type Mounted, useAtomValue, useLocal } from '../index'
import { acceptUpdate } from '../internal'
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
const go = async (app: any, onError?: (cause: Cause.Cause<unknown>) => void) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const store = makeAtomStore()
  await act(async () => void handles.push(await mount(app, { layer: Layer.empty, container, store, onError } as any)))
  return { container, store }
}

// A component version: shows its label and a `useLocal` count, with an input to hold focus.
let set: (n: number) => void = () => {}
const version = (label: string) => () =>
  Effect.gen(function* () {
    const [n, setN] = yield* useLocal(0)
    set = setN
    return el('div', {}, el('p', {}, `${label} ${n}`), el('input', {}))
  })

describe('acceptUpdate', () => {
  it('re-runs a live instance with the new function, keeping useLocal state and input focus; a re-evaluated reference keeps the instance', async () => {
    const v1 = version('v1')
    acceptUpdate('hmr.test#Counter', v1)
    // The parent holds whichever reference its module evaluation gave it; it re-runs when `tick` changes.
    let ref = v1
    const parentTick = Atom.make(0)
    const App = () =>
      Effect.gen(function* () {
        yield* useAtomValue(parentTick)
        return yield* jsx(ref, {})
      })
    const { container, store } = await go(jsx(App, {}))
    act(() => set(2))
    await tick()
    const input = container.querySelector('input')!
    input.focus()
    expect(container.querySelector('p')!.textContent).toBe('v1 2')

    const v2 = version('v2')
    acceptUpdate('hmr.test#Counter', v2)
    await tick()
    expect(container.querySelector('p')!.textContent).toBe('v2 2')
    expect(container.querySelector('input')).toBe(input)
    expect(document.activeElement).toBe(input)

    // The parent's module re-evaluated too: its new reference shares the stable id, so the instance and its state stay.
    ref = version('v3')
    acceptUpdate('hmr.test#Counter', ref)
    store.set(parentTick, 1)
    await tick()
    expect(container.querySelector('p')!.textContent).toBe('v3 2')
    expect(document.activeElement).toBe(input)
  })

  it('a throwing update keeps the previous function and reports the error', async () => {
    const errors: Array<Cause.Cause<unknown>> = []
    const v1 = version('v1')
    acceptUpdate('hmr.test#Thrower', v1)
    const { container } = await go(jsx(v1, {}), (cause) => errors.push(cause))
    act(() => set(5))
    await tick()

    acceptUpdate('hmr.test#Thrower', () => {
      throw new Error('broken edit')
    })
    await tick()
    expect(errors).toHaveLength(1)
    expect(Cause.pretty(errors[0]!)).toContain('broken edit')
    expect(container.querySelector('p')!.textContent).toBe('v1 5')
    // A later re-run uses the previous function, not the broken one.
    act(() => set(6))
    await tick()
    expect(container.querySelector('p')!.textContent).toBe('v1 6')
    expect(errors).toHaveLength(1)

    // The previous function is current again: the next fix applies on top of it with the state intact.
    acceptUpdate('hmr.test#Thrower', version('fixed'))
    await tick()
    expect(container.querySelector('p')!.textContent).toBe('fixed 6')
    expect(errors).toHaveLength(1)
  })

  it('an update that throws for one instance reverts every instance, also after a second update before any re-run', async () => {
    const errors: Array<Cause.Cause<unknown>> = []
    const row = (label: string) => (props: { readonly bad?: boolean }) => {
      if (props.bad && label !== 'v1') throw new Error(`${label} broke`)
      return Effect.succeed(el('li', {}, label))
    }
    const v1 = row('v1')
    acceptUpdate('hmr.test#Row', v1)
    const App = () =>
      Effect.gen(function* () {
        return el('ul', {}, yield* jsx(v1, {}), yield* jsx(v1, { bad: true }))
      })
    const { container } = await go(jsx(App, {}), (cause) => errors.push(cause))
    const text = () => [...container.querySelectorAll('li')].map((li) => li.textContent).join(',')

    acceptUpdate('hmr.test#Row', row('v2'))
    await tick()
    expect(text()).toBe('v1,v1')
    expect(errors).toHaveLength(1)

    // Two broken updates land before the re-run: the revert goes to v1, the last one that ran, not to the first broken one.
    acceptUpdate('hmr.test#Row', row('v3'))
    acceptUpdate('hmr.test#Row', row('v4'))
    await tick()
    expect(text()).toBe('v1,v1')
    expect(errors).toHaveLength(2)
  })

  it('an update that changes an instance hook count remounts that instance; keyed siblings keep their state', async () => {
    const errors: Array<Cause.Cause<unknown>> = []
    const sets = new Map<string, (n: number) => void>()
    // `extraFor` names the row whose run calls one more `useLocal` than v1 did.
    const row = (label: string, extraFor?: string) => (props: { readonly id: string }) =>
      Effect.gen(function* () {
        const [n, setN] = yield* useLocal(0)
        if (props.id === extraFor) yield* useLocal('extra')
        sets.set(props.id, setN)
        return el('li', {}, `${label} ${props.id}${n}`)
      })
    const v1 = row('v1')
    acceptUpdate('hmr.test#KeyedRow', v1)
    const App = () =>
      Effect.gen(function* () {
        const ids = ['a', 'b', 'c']
        return el('ul', {}, ...(yield* Effect.all(ids.map((id) => rawJsx(v1, { id }, id)))))
      })
    const { container } = await go(jsx(App, {}), (cause) => errors.push(cause))
    const text = () => [...container.querySelectorAll('li')].map((li) => li.textContent).join(',')
    act(() => {
      for (const [id, n] of [
        ['a', 1],
        ['b', 2],
        ['c', 3],
      ] as const)
        sets.get(id)!(n)
    })
    await tick()
    expect(text()).toBe('v1 a1,v1 b2,v1 c3')

    // Row b gains a hook: it remounts with fresh state, a and c keep theirs.
    acceptUpdate('hmr.test#KeyedRow', row('v2', 'b'))
    await tick()
    expect(errors).toHaveLength(0)
    expect(text()).toBe('v2 a1,v2 b0,v2 c3')

    // Row b loses the hook again: another remount, still no error.
    act(() => sets.get('b')!(4))
    await tick()
    acceptUpdate('hmr.test#KeyedRow', row('v3'))
    await tick()
    expect(errors).toHaveLength(0)
    expect(text()).toBe('v3 a1,v3 b0,v3 c3')
  })

  it('outside a hot update a hook-count change still fails into onError', async () => {
    const errors: Array<Cause.Cause<unknown>> = []
    let extra = false
    const C = () =>
      Effect.gen(function* () {
        const [n, setN] = yield* useLocal(0)
        if (extra) yield* useLocal(0)
        set = setN
        return el('p', {}, String(n))
      })
    acceptUpdate('hmr.test#Conditional', C)
    await go(jsx(C, {}), (cause) => errors.push(cause))
    extra = true
    act(() => set(1))
    await tick()
    expect(errors).toHaveLength(1)
    expect(Cause.pretty(errors[0]!)).toContain('SlotMismatch')
  })

  it('a disposed mount is not updated', async () => {
    const v1 = version('v1')
    acceptUpdate('hmr.test#Disposed', v1)
    const { store } = await go(jsx(v1, {}))
    await act(async () => void (await handles.pop()!.dispose()))
    const update = vi.spyOn(store, 'update')
    acceptUpdate('hmr.test#Disposed', version('v2'))
    expect(update).not.toHaveBeenCalled()
  })
})
