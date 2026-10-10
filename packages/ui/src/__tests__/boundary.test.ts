// @vitest-environment jsdom
import { makeAtomStore } from '@sleekstack/core'
import { Data, Effect, Layer } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Boundary, el, lazy, LazyLoadError, mount, type Mounted, Pending, Provider, type Reset } from '../index'
import { jsx as rawJsx } from '../jsx-runtime'

const jsx = (type: any, props: any) => rawJsx(type, props)
const tick = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))
class Boom extends Data.TaggedError('Boom') {}

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
  const errors: Array<unknown> = []
  let h!: Mounted
  await act(async () => {
    h = await mount(app, { layer: Layer.empty, container, store: makeAtomStore(), onError: (c) => errors.push(c) })
    handles.push(h)
  })
  return { container, errors, handle: h }
}
const click = (container: Element) => act(() => void container.querySelector('button')!.click())

// Fails its first `failures` runs; each run builds a scoped layer whose release is counted.
const flaky = (failures: number) => {
  const counts = { runs: 0, acquired: 0, released: 0 }
  const res = Layer.scopedDiscard(
    Effect.acquireRelease(
      Effect.sync(() => counts.acquired++),
      () => Effect.sync(() => counts.released++),
    ),
  )
  const Inner = () =>
    Effect.suspend(() => (++counts.runs <= failures ? Effect.fail(new Boom()) : Effect.succeed(el('b', {}, 'ok'))))
  const Child = () => jsx(Provider, { layer: res, children: jsx(Inner, {}) })
  return { counts, Child }
}

describe('Boundary reset (R4, R5, R6, R9, R10)', () => {
  it.each<[string, (reset: Reset) => unknown]>([
    ['a function', (reset) => reset],
    [
      'an Effect',
      (reset) => () =>
        Effect.gen(function* () {
          yield* reset()
        }),
    ],
  ])('R4/R5: reset as %s retries; success replaces the fallback', async (_, onClick) => {
    const { counts, Child } = flaky(1)
    const tree = jsx(Boundary, {
      tag: 'Boom',
      fallback: (_e: Boom, reset: Reset) => jsx('button', { onClick: onClick(reset), children: 'retry' }),
      children: jsx(Child, {}),
    })
    const { container, errors } = await go(tree)
    expect(container.textContent).toBe('retry')
    await click(container)
    await tick()
    expect(container.textContent).toBe('ok')
    expect(counts.runs).toBe(2)
    expect(errors).toEqual([])
  })

  it('R6: a failing retry shows the fallback again, releases the attempt, and a second click on a spent reset does nothing', async () => {
    const { counts, Child } = flaky(2)
    let captured: Reset | undefined
    const tree = jsx(Boundary, {
      tag: 'Boom',
      fallback: (_e: Boom, reset: Reset) => ((captured = reset), jsx('button', { onClick: reset, children: 'retry' })),
      children: jsx(Child, {}),
    })
    const { container } = await go(tree)
    const first = captured!
    await click(container)
    first()
    await tick()
    expect(container.textContent).toBe('retry')
    expect(counts.runs).toBe(2)
    expect(counts.released).toBe(counts.acquired)
    await click(container)
    await tick()
    expect(container.textContent).toBe('ok')
    expect(counts.runs).toBe(3)
  })

  it('R9: reset retries a failed lazy import', async () => {
    const load = vi
      .fn<() => Promise<{ default: () => Effect.Effect<any> }>>()
      .mockRejectedValueOnce(new Error('chunk'))
      .mockResolvedValue({ default: () => Effect.succeed(el('b', {}, 'loaded')) })
    const L = lazy(load)
    const tree = jsx(Boundary, {
      tag: 'LazyLoadError',
      fallback: (_e: LazyLoadError, reset: Reset) => jsx('button', { onClick: reset, children: 'retry' }),
      children: jsx(Pending, { fallback: 'loading', children: jsx(L, {}) }),
    })
    const { container } = await go(tree)
    await tick()
    expect(container.textContent).toBe('retry')
    await click(container)
    await tick()
    expect(container.textContent).toBe('loaded')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('R10: reset after the boundary is disposed does nothing', async () => {
    const { counts, Child } = flaky(1)
    let captured: Reset | undefined
    const tree = jsx(Boundary, {
      tag: 'Boom',
      fallback: (_e: Boom, reset: Reset) => ((captured = reset), Effect.succeed(el('p', {}, 'caught'))),
      children: jsx(Child, {}),
    })
    const { handle, errors } = await go(tree)
    await act(() => handle.dispose())
    captured!()
    await tick()
    expect(counts.runs).toBe(1)
    expect(errors).toEqual([])
  })
})
