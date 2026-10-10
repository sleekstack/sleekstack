// @vitest-environment jsdom
import { Effect, Layer, Option, Schema } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { type ActionEvent, mount, type Mounted } from '@sleekstack/ui'
import { jsx as rawJsx } from '@sleekstack/ui/jsx-runtime'
import { action, Link, type Loader, loader, Loaders, match, routeLayer, routes, useLoader } from '../index'

const jsx = (type: any, props: any) => rawJsx(type, props)
const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))
const table = routes({ user: '/users/:id' })

let handles: Array<Mounted> = []
beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})
afterEach(async () => {
  await act(async () => {
    for (const h of handles) await h.dispose()
  })
  handles = []
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

const render = async (node: unknown, all = new Map(), onError = vi.fn()) => {
  const container = document.createElement('div')
  document.body.append(container)
  const layer = Layer.succeed(Loaders, all)
  await act(async () => void handles.push(await mount(node as never, { layer, container, onError })))
  return { a: container.querySelector('a')!, all, onError, container }
}
const read = (all: Map<string, any>, l: Loader<string, string>) =>
  Effect.runPromise(
    useLoader(l).pipe(
      Effect.provide(Layer.merge(Layer.succeed(Loaders, all), routeLayer(Option.getOrThrow(match(table, '/users/7'))))),
    ) as Effect.Effect<unknown>,
  )

describe('Link', () => {
  const counted = () => {
    const state = { calls: 0, imports: 0 }
    const l = loader(
      'user',
      Schema.String,
      Effect.sync(() => `u${++state.calls}`),
    )
    const code = () => (state.imports++, Promise.resolve({}))
    return { state, l, code }
  }

  it('prefetches code and loader once on hover and focus; the page reads the prefetched result', async () => {
    const { state, l, code } = counted()
    const { a, all } = await render(jsx(Link, { href: '/users/7', table, code, loaders: [l], children: 'Ada' }))
    expect(a.getAttribute('href')).toBe('/users/7')
    a.dispatchEvent(new MouseEvent('mouseenter'))
    a.dispatchEvent(new FocusEvent('focus'))
    await flush()
    expect(state.calls).toBe(1)
    expect(state.imports).toBe(2) // the module system dedupes the import itself
    expect(await read(all, l)).toBe('u1')
    expect(state.calls).toBe(1)
  })

  it('prefetch={false} does nothing on hover or focus', async () => {
    const { state, l, code } = counted()
    const { a } = await render(jsx(Link, { href: '/users/7', table, code, loaders: [l], prefetch: false }))
    a.dispatchEvent(new MouseEvent('mouseenter'))
    a.dispatchEvent(new FocusEvent('focus'))
    await flush()
    expect(state).toEqual({ calls: 0, imports: 0 })
  })

  it('an unread prefetched result expires; the page then loads again', async () => {
    const { state, l } = counted()
    const { a, all } = await render(jsx(Link, { href: '/users/7', table, loaders: [l] }))
    a.dispatchEvent(new MouseEvent('mouseenter'))
    await flush()
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now + 60_000)
    expect(await read(all, l)).toBe('u2')
  })

  it('a prefetch error is silent', async () => {
    const failing = loader('bad', Schema.String, Effect.fail('boom'))
    const { a, all, onError } = await render(
      jsx(Link, { href: '/users/7', table, code: () => Promise.reject(new Error('x')), loaders: [failing] }),
    )
    a.dispatchEvent(new MouseEvent('mouseenter'))
    await flush()
    expect(onError).not.toHaveBeenCalled()
    expect(all.size).toBe(0)
  })
})

describe('action', () => {
  it.each([
    ['function', (seen: Array<string>) => action((e: ActionEvent) => void seen.push(String(e.formData.get('t'))))],
    [
      'generator',
      (seen: Array<string>) =>
        action(function* (e: ActionEvent) {
          yield* Effect.void
          seen.push(String(e.formData.get('t')))
        }),
    ],
    ['Effect', (seen: Array<string>) => action(Effect.sync(() => void seen.push('effect')))],
  ])('a %s action runs on submit', async (name, make) => {
    const seen: Array<string> = []
    const { container } = await render(
      jsx('form', { action: make(seen), children: [jsx('input', { name: 't', value: 'hi' }), jsx('button', {})] }),
    )
    container.querySelector('form')!.requestSubmit()
    await flush()
    expect(seen).toEqual([name === 'Effect' ? 'effect' : 'hi'])
  })
})
