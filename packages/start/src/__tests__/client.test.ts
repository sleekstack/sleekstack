// @vitest-environment jsdom
import { action, NotFound, notFound, Redirect, redirect, router, routes, startRouter } from '@sleekstack/router'
import { type ActionEvent, el, mount, type Mounted, useAction, useAtomValue } from '@sleekstack/ui'
import { jsx as rawJsx } from '@sleekstack/ui/jsx-runtime'
import { Data, Effect, Either, Layer, Schema } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { client, DecodeError, NetworkError, serverClient, serverClients, ServerService, taggedError } from '../client'
import { serverFn, type ServerServiceEntry, start } from '../index'

const jsx = (type: any, props: any) => rawJsx(type, props)
const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))

class Full extends Schema.TaggedError<Full>()('Full', { max: Schema.Number }) {}

// The client-safe contract; the server function is built from it.
const addItem = {
  id: 'items.add',
  input: Schema.Struct({ title: Schema.NonEmptyString }),
  success: Schema.Struct({ count: Schema.Number }),
  error: Full,
}
const items: Array<string> = []
const addItemFn = serverFn(
  addItem.id,
  addItem,
)(function* ({ title }) {
  if (title === 'full') return yield* new Full({ max: 1 })
  if (title === 'redirect') return yield* redirect('/done')
  if (title === 'missing') return yield* notFound()
  items.push(title)
  return { count: items.length }
})

const server = start({
  router: router({
    table: routes({ home: '/' }),
    pages: { home: { render: () => Effect.succeed(el('p', {}, 'home')) } },
    notFound: () => Effect.succeed(el('p', {}, 'missing')),
  }),
  functions: [addItemFn],
})

const origin = location.origin
// The browser's `fetch`, answered by the server's: same origin, so it sends `Origin`.
const serve = vi.fn((url: string, init: RequestInit) =>
  server.fetch(new Request(new URL(url, origin), { ...init, headers: { ...init.headers, origin } })),
)
const add = client(addItem)
const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.either(effect))

let mounts: Array<Mounted> = []
beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})
afterEach(async () => {
  await act(async () => {
    for (const h of mounts) await h.dispose()
  })
  mounts = []
  document.body.replaceChildren()
  items.length = 0
  vi.unstubAllGlobals()
  serve.mockClear()
})
const stubFetch = (impl: (url: string, init: RequestInit) => Promise<Response> = serve) =>
  vi.stubGlobal('fetch', vi.fn(impl))

describe('client stub', () => {
  it('posts the encoded input and decodes the success value', async () => {
    stubFetch()
    expect(await run(add({ title: 'milk' }))).toEqual(Either.right({ count: 1 }))
    expect(serve).toHaveBeenCalledWith('/_sleek/fn/items.add', expect.objectContaining({ method: 'POST' }))
  })

  it('fails with the declared error, and with the router’s own Redirect / NotFound', async () => {
    stubFetch()
    expect(await run(add({ title: 'full' }))).toEqual(Either.left(new Full({ max: 1 })))
    const redirected = await run(add({ title: 'redirect' }))
    expect(Either.isLeft(redirected) && redirected.left).toBeInstanceOf(Redirect)
    expect(redirected).toEqual(Either.left(new Redirect({ to: '/done' })))
    const missing = await run(add({ title: 'missing' }))
    expect(Either.isLeft(missing) && missing.left).toBeInstanceOf(NotFound)
  })

  it.each([
    ['fetch rejects', () => Promise.reject(new TypeError('offline')), NetworkError, undefined],
    ['a status with no envelope', async () => new Response(null, { status: 500 }), NetworkError, 500],
    [
      'a value failing its Schema',
      async () => Response.json({ _tag: 'Success', value: { count: 'x' } }),
      DecodeError,
      undefined,
    ],
    ['an unknown envelope', async () => Response.json({ _tag: 'Teleport' }), DecodeError, undefined],
    ['a 200 that is not JSON', async () => new Response('<html>'), DecodeError, undefined],
  ])('%s fails with the matching error', async (_, impl, type, status) => {
    stubFetch(impl)
    const result = await run(add({ title: 'milk' }))
    expect(Either.isLeft(result) && result.left).toBeInstanceOf(type)
    if (status) expect(result).toMatchObject({ left: { status } })
  })

  it('input failing its Schema is a DecodeError before any request', async () => {
    stubFetch()
    const result = await run(add({ title: '' }))
    expect(Either.isLeft(result) && result.left).toBeInstanceOf(DecodeError)
    expect(serve).not.toHaveBeenCalled()
  })
})

describe('the stub where actions go', () => {
  const form = (formAction: unknown, title: string, children: unknown = []) =>
    jsx('form', { action: formAction, children: [jsx('input', { name: 'title', value: title }), children] })
  const container = () => document.body.firstElementChild!
  const host = async (app: any) => {
    document.body.innerHTML = '<div></div>'
    await act(async () => void mounts.push(await mount(app, { layer: Layer.empty, container: container() })))
  }
  const submit = async () => {
    await act(() => container().querySelector('form')!.requestSubmit())
    await flush()
  }

  it('as a form action, its FormData decoded with the input Schema', async () => {
    stubFetch()
    await host(form(add, 'milk'))
    await submit()
    expect(items).toEqual(['milk'])
  })

  it('FormData failing the input Schema is a DecodeError before any request', async () => {
    stubFetch()
    const formData = new FormData()
    formData.set('title', '')
    const result = await run(add({ formData } as ActionEvent))
    expect(Either.isLeft(result) && result.left).toBeInstanceOf(DecodeError)
    expect(serve).not.toHaveBeenCalled()
  })

  it('through useAction, its result in the Result atom', async () => {
    stubFetch()
    await host(
      jsx(function* () {
        const [result, bound] = yield* useAction(add)
        const r = yield* useAtomValue(result)
        return form(bound, 'eggs', jsx('output', { children: r._tag === 'Success' ? String(r.value.count) : r._tag }))
      }, {}),
    )
    await submit()
    expect(container().querySelector('output')!.textContent).toBe('1')
  })

  it('as a router action, whose Redirect navigates', async () => {
    stubFetch()
    const app = router({
      table: routes({ form: '/form', done: '/done' }),
      pages: {
        form: {
          render: () => form(action(add), 'redirect'),
        },
        done: { render: () => Effect.succeed(el('p', {}, 'done')) },
      },
      notFound: () => Effect.succeed(el('p', {}, 'missing')),
    })
    history.replaceState(null, '', '/form')
    document.body.innerHTML = '<div></div>'
    await act(async () => void (await startRouter(app, { container: container() })))
    await submit()
    expect([location.pathname, container().textContent]).toEqual(['/done', 'done'])
  })
})

class NameTaken extends Data.TaggedError('NameTaken')<{ readonly name: string }> {}
class Profiles extends ServerService('Profiles')<
  Profiles,
  {
    readonly rename: (input: { readonly name: string }) => Effect.Effect<{ readonly name: string }, NameTaken>
    readonly count: () => Effect.Effect<number>
  }
>() {}
const profiles: ServerServiceEntry<Profiles, Profiles['Type']> = {
  tag: Profiles,
  methods: {
    rename: {
      input: Schema.Struct({ name: Schema.String }),
      success: Schema.Struct({ name: Schema.String }),
      error: taggedError(NameTaken, { name: Schema.String }),
    },
    count: { input: Schema.Void, success: Schema.Number },
  },
}
const profilesServer = start({
  router: router({
    table: routes({ home: '/' }),
    pages: { home: { render: () => Effect.succeed(el('p', {}, 'home')) } },
    notFound: () => Effect.succeed(el('p', {}, 'missing')),
  }),
  layer: Layer.succeed(Profiles, {
    rename: ({ name }) => (name === 'taken' ? Effect.fail(new NameTaken({ name })) : Effect.succeed({ name })),
    count: () => Effect.succeed(3),
  }),
  services: [profiles],
})
const serveProfiles = vi.fn((url: string, init: RequestInit) =>
  profilesServer.fetch(new Request(new URL(url, origin), { ...init, headers: { ...init.headers, origin } })),
)
const viaClient = <A, E>(effect: Effect.Effect<A, E, Profiles>) =>
  run(Effect.provide(effect, serverClients([profiles])))

describe('serverClient', () => {
  afterEach(() => serveProfiles.mockClear())

  it('a method posts its encoded input to /_sleek/fn/<Tag>.<method>', async () => {
    stubFetch(serveProfiles)
    expect(await viaClient(Effect.flatMap(Profiles, (p) => p.rename({ name: 'ada' })))).toEqual(
      Either.right({ name: 'ada' }),
    )
    expect(serveProfiles).toHaveBeenCalledWith(
      '/_sleek/fn/Profiles.rename',
      expect.objectContaining({ method: 'POST', body: '{"name":"ada"}' }),
    )
  })

  it('a zero-argument method posts an empty body', async () => {
    stubFetch(serveProfiles)
    expect(await viaClient(Effect.flatMap(Profiles, (p) => p.count()))).toEqual(Either.right(3))
    expect(serveProfiles).toHaveBeenCalledWith(
      '/_sleek/fn/Profiles.count',
      expect.objectContaining({ body: undefined }),
    )
  })

  it('a Failure envelope decodes into the declared error class', async () => {
    stubFetch(serveProfiles)
    const result = await viaClient(Effect.flatMap(Profiles, (p) => p.rename({ name: 'taken' })))
    expect(Either.isLeft(result) && result.left).toBeInstanceOf(NameTaken)
    expect(result).toMatchObject({ left: { _tag: 'NameTaken', name: 'taken' } })
  })

  it.each([
    ['a rejected fetch', () => Promise.reject(new TypeError('offline')), NetworkError],
    [
      'a success body failing the success Schema',
      async () => Response.json({ _tag: 'Success', value: 'x' }),
      DecodeError,
    ],
  ])('%s fails with the matching error', async (_, impl, type) => {
    stubFetch(impl)
    const result = await run(
      Effect.provide(
        Effect.flatMap(Profiles, (p) => p.count()),
        serverClient(profiles),
      ),
    )
    expect(Either.isLeft(result) && result.left).toBeInstanceOf(type)
  })
})
