// @vitest-environment jsdom
import { Data, Effect, Fiber, Layer, Option, Schema } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  Boundary,
  el,
  Transfer,
  hydrateMount,
  type Mounted,
  Pending,
  renderToStream,
  renderToString,
} from '@sleekstack/ui'
import { jsx as rawJsx } from '@sleekstack/ui/jsx-runtime'
import { loader, LoaderTransferLive, match, routeLayer, routes, useLoader } from '../index'

const jsx = (type: any, props: any) => rawJsx(type, props)
const table = routes({ user: '/users/:id' })
const route = () => routeLayer(Option.getOrThrow(match(table, '/users/7')))
const layer = () => Layer.merge(LoaderTransferLive, route())
const strip = (html: string) =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<template data-sleek-b="[^"]*"><\/template>/g, '')
    .replace(/<!--\/?sleek-p[^>]*-->/g, '')

let calls = 0
// A Date only survives the transfer through its schema; two Pendings read the one loader.
const user = loader(
  'user',
  Schema.Struct({ name: Schema.String, born: Schema.Date }),
  Effect.promise(async () => (calls++, { name: 'Ada', born: new Date('1815-12-10') })),
)
const Page = () => Effect.map(useLoader(user), (u) => el('b', {}, `${u.name}:${u.born.getUTCFullYear()}`))
const pending = () => jsx(Pending, { fallback: jsx('i', { children: 'wait' }), children: jsx(Page, {}) })
const app = () => jsx('div', { children: [pending(), pending()] })

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
    expect(calls).toBe(2) // one load per render, shared by both readers
    const dom = strip(html)
    expect(dom).toBe('<div><b>Ada:1815</b><b>Ada:1815</b></div>')
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
      Schema.String,
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
    const failing = loader('missing', Schema.String, Effect.fail(new NotFound({ id: '7' })))
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

  it('carries an outer Transfer beside the loaders', async () => {
    let seeded: unknown
    const inner = Layer.succeed(Transfer, { dehydrate: () => 'q', hydrate: (s) => void (seeded = s) })
    const both = () => Layer.merge(LoaderTransferLive.pipe(Layer.provideMerge(inner)), route())
    const html = await renderToString(app(), { layer: both() })
    const container = document.createElement('div')
    container.innerHTML = html
    await act(async () => void handles.push(await hydrateMount(app(), { layer: both(), container })))
    expect(seeded).toBe('q')
    expect(calls).toBe(1)
  })

  it('a shared load survives the interrupt of one reader and stops with the last', async () => {
    let open!: () => void
    let interrupted = 0
    let stopped = 0
    const gate = new Promise<void>((r) => (open = r))
    const shared = loader(
      'shared',
      Schema.String,
      Effect.promise(() => gate.then(() => 'ok')).pipe(Effect.onInterrupt(() => Effect.sync(() => interrupted++))),
    )
    const run = Effect.gen(function* () {
      const first = yield* Effect.fork(useLoader(shared))
      const second = yield* Effect.fork(useLoader(shared))
      yield* Effect.yieldNow()
      yield* Fiber.interrupt(first)
      open()
      const ok = yield* Fiber.join(second)
      const third = yield* Effect.fork(
        useLoader(
          loader('stuck', Schema.String, Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(() => stopped++)))),
        ),
      )
      yield* Effect.yieldNow()
      yield* Fiber.interrupt(third)
      return ok
    })
    expect(await Effect.runPromise(Effect.provide(run, layer()))).toBe('ok')
    expect(interrupted).toBe(0)
    expect(stopped).toBe(1)
  })
})
