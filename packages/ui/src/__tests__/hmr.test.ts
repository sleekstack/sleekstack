// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import { Cause, Effect, Layer } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
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
})
