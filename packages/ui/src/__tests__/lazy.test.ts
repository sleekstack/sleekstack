// @vitest-environment jsdom
import { makeAtomStore } from '@sleekstack/core'
import { Cause, Effect, Layer } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Boundary, el, hydrateMount, lazy, LazyLoadError, mount, type Mounted, Pending, renderToString } from '../index'
import { jsx as rawJsx } from '../jsx-runtime'

const jsx = (type: any, props: any) => rawJsx(type, props)
const tick = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))
const Hello = (props: { name: string }) => Effect.succeed(el('b', {}, `hi ${props.name}`))
const strip = (html: string) => html.replace(/<sleek-reactive[^>]*>|<\/sleek-reactive>|<!--[^>]*-->/g, '')

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
  const errors: Array<Cause.Cause<unknown>> = []
  await act(
    async () =>
      void handles.push(
        await mount(app, {
          layer: Layer.empty,
          container,
          store: makeAtomStore(),
          onError: (c: Cause.Cause<unknown>) => errors.push(c),
        } as any),
      ),
  )
  return { container, errors }
}

describe('lazy', () => {
  it('R1: mount shows the Pending fallback, then the loaded component', async () => {
    let open!: () => void
    const gate = new Promise<void>((r) => (open = r))
    const L = lazy<{ name: string }>(() => gate.then(() => ({ default: Hello })))
    const { container } = await go(jsx(Pending, { fallback: 'loading', children: jsx(L, { name: 'a' }) }))
    expect(container.textContent).toBe('loading')
    open()
    await tick()
    expect(container.textContent).toBe('hi a')
  })

  it('R2: renderToString awaits the import and hydrateMount adopts the server node', async () => {
    const L = lazy(async () => ({ default: Hello }))
    const app = () => jsx(Pending, { fallback: 'loading', children: jsx(L, { name: 'b' }) })
    const html = await renderToString(app(), { layer: Layer.empty })
    expect(strip(html)).toBe('<b>hi b</b>')
    const container = document.createElement('div')
    container.innerHTML = html
    const b = container.querySelector('b')
    const onError = vi.fn()
    await act(async () => void handles.push(await hydrateMount(app(), { layer: Layer.empty, container, onError })))
    expect(onError).not.toHaveBeenCalled()
    expect(container.querySelector('b')).toBe(b)
  })

  it('R3: a re-render does not import again', async () => {
    const load = vi.fn(async () => ({ default: Hello }))
    const L = lazy(load)
    await renderToString(jsx(L, { name: 'x' }), { layer: Layer.empty })
    await renderToString(jsx(L, { name: 'y' }), { layer: Layer.empty })
    expect(load).toHaveBeenCalledTimes(1)
  })

  it.each<[string, () => Promise<any>]>([
    ['a rejected import', () => Promise.reject(new Error('chunk'))],
    ['a module with no default export', async () => ({}) as any],
  ])('R4/R8: %s is a LazyLoadError at the nearest Boundary', async (_, load) => {
    const L = lazy(load)
    const tree = jsx(Boundary, {
      tag: 'LazyLoadError',
      fallback: (e: LazyLoadError) => Effect.succeed(el('p', {}, e._tag)),
      children: jsx(Pending, { fallback: 'loading', children: jsx(L, { name: 'z' }) }),
    })
    const { container, errors } = await go(tree)
    await tick()
    expect(container.textContent).toBe('LazyLoadError')
    expect(errors).toEqual([])
  })

  it('R4/R7: with no Boundary it reaches onError, and the next render retries the import', async () => {
    const load = vi
      .fn<() => Promise<{ default: typeof Hello }>>()
      .mockRejectedValueOnce(new Error('chunk'))
      .mockResolvedValue({ default: Hello })
    const L = lazy(load)
    const { errors } = await go(jsx(Pending, { fallback: 'loading', children: jsx(L, { name: 'r' }) }))
    await tick()
    expect(errors.length).toBe(1)
    expect(Cause.squash(errors[0]!)).toBeInstanceOf(LazyLoadError)
    expect(strip(await renderToString(jsx(L, { name: 'r' }), { layer: Layer.empty }))).toBe('<b>hi r</b>')
    expect(load).toHaveBeenCalledTimes(2)
  })
})
