// @vitest-environment jsdom
import { Data, Effect, Layer, Option } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Boundary, el, hydrateMount, type Mounted, Pending, renderToStream, renderToString } from '@sleekstack/ui'
import { jsx as rawJsx } from '@sleekstack/ui/jsx-runtime'
import { loader, LoaderTransferLive, match, routeLayer, routes, useLoader } from '../index'

const jsx = (type: any, props: any) => rawJsx(type, props)
const table = routes({ user: '/users/:id' })
const layer = () => Layer.merge(LoaderTransferLive, routeLayer(Option.getOrThrow(match(table, '/users/7'))))
const strip = (html: string) =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<template data-sleek-b="[^"]*"><\/template>/g, '')
    .replace(/<!--\/?sleek-p[^>]*-->/g, '')

let calls = 0
const user = loader(
  'user',
  Effect.promise(async () => (calls++, { name: 'Ada' })),
)
const Page = () => Effect.map(useLoader(user), (u) => el('b', {}, u.name))
const app = () =>
  jsx('div', { children: jsx(Pending, { fallback: jsx('i', { children: 'wait' }), children: jsx(Page, {}) }) })

let handles: Array<Mounted> = []
beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})
afterEach(async () => {
  await act(async () => {
    for (const h of handles) await h.dispose()
  })
  handles = []
  calls = 0
})

const hydrate = async (html: string) => {
  const container = document.createElement('div')
  document.body.replaceChildren(container)
  container.innerHTML = html
  for (const s of [...container.querySelectorAll('script:not([type])')]) (s.remove(), new Function(s.textContent!)())
  const errors: Array<unknown> = []
  await act(
    async () =>
      void handles.push(await hydrateMount(app(), { layer: layer(), container, onError: (c) => errors.push(c) })),
  )
  await act(() => new Promise((r) => setTimeout(r, 0)))
  expect(errors).toEqual([])
  return container.innerHTML
}

describe('useLoader', () => {
  it('string, stream and hydrate give the same DOM; the client reads transferred data without reloading', async () => {
    const html = await renderToString(app(), { layer: layer() })
    expect(html).toContain('data-sleek-hydrate')
    const streamed = await new Response(renderToStream(app(), { layer: layer() })).text()
    expect(calls).toBe(2)
    const dom = strip(html)
    expect(dom).toBe('<div><b>Ada</b></div>')
    const swapped = document.createElement('div')
    document.body.replaceChildren(swapped)
    swapped.innerHTML = streamed
    for (const s of [...swapped.querySelectorAll('script:not([type])')]) (s.remove(), new Function(s.textContent!)())
    expect(strip(swapped.innerHTML)).toBe(dom)
    expect(strip(await hydrate(html))).toBe(dom)
    expect(strip(await hydrate(streamed))).toBe(dom)
    expect(calls).toBe(2)
  })

  it('streaming a slow loader sends the shell with the fallback first', async () => {
    let open!: () => void
    const gate = new Promise<void>((r) => (open = r))
    const slow = loader(
      'slow',
      Effect.promise(() => gate.then(() => 'late')),
    )
    const Slow = () => Effect.map(useLoader(slow), (s) => el('b', {}, s))
    const reader = renderToStream(
      jsx('div', { children: jsx(Pending, { fallback: jsx('i', { children: 'wait' }), children: jsx(Slow, {}) }) }),
      { layer: layer() },
    ).getReader()
    const shell = new TextDecoder().decode((await reader.read()).value)
    expect(shell).toContain('<i>wait</i>')
    expect(shell).not.toContain('<b>late')
    open()
    let rest = ''
    for (let r = await reader.read(); !r.done; r = await reader.read()) rest += new TextDecoder().decode(r.value)
    expect(rest).toContain('<b>late</b>')
  })

  it('a typed loader error reaches the nearest Boundary', async () => {
    class NotFound extends Data.TaggedError('NotFound')<{ readonly id: string }> {}
    const failing = loader('missing', Effect.fail(new NotFound({ id: '7' })))
    const Page = () => Effect.map(useLoader(failing), () => el('b', {}, 'never'))
    const html = await renderToString(
      jsx(Boundary, {
        tag: 'NotFound',
        fallback: (e: NotFound) => Effect.succeed(el('p', {}, `${e._tag}:${e.id}`)),
        children: jsx(Pending, { fallback: 'wait', children: jsx(Page, {}) }),
      }),
      { layer: layer() },
    )
    expect(html).toContain('<p>NotFound:7</p>')
  })
})
