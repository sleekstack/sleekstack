import { loader, router, routes, useLoader } from '@sleekstack/router'
import { el } from '@sleekstack/ui'
import { type Cause, Context, Effect, Layer, Schema } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  Cookies,
  type DiscoveredApp,
  type DiscoveredService,
  type GeneratedServiceShape,
  type RpcWrap,
  serverFn,
  serviceLayer,
  start,
} from '../index'

// A build-time service: counts the builds of its Layer.
class Store extends Context.Tag('Store')<Store, { readonly build: number }>() {}
// A service only the `wrap` provides, read from the request's cookie.
class Viewer extends Context.Tag('Viewer')<Viewer, string>() {}
class Missing extends Schema.TaggedError<Missing>()('Missing', { id: Schema.String }) {}

let builds = 0
const StoreLive = Layer.effect(
  Store,
  Effect.sync(() => ({ build: ++builds })),
)

const methods = {
  whoami: (): Effect.Effect<string, never, Store | Viewer> =>
    Effect.gen(function* () {
      return `${yield* Viewer} ${(yield* Store).build}`
    }),
  find: ({ id }: { readonly id: string }): Effect.Effect<string, Missing> => Effect.fail(new Missing({ id })),
  boom: (): Effect.Effect<string, string> => Effect.fail('boom'),
}
class Comments extends Context.Tag('Comments')<Comments, GeneratedServiceShape<typeof methods>>() {}

const wrap: RpcWrap = (next) =>
  Effect.flatMap(Cookies, (cookies) => Effect.provideService(next, Viewer, cookies.get('session') ?? 'anonymous'))

const comments: DiscoveredService = {
  entry: {
    tag: Comments,
    methods: {
      whoami: { input: Schema.Void, success: Schema.String },
      find: { input: Schema.Struct({ id: Schema.String }), success: Schema.String, error: Missing },
      boom: { input: Schema.Void, success: Schema.String },
    },
  },
  layer: serviceLayer(Comments, methods, wrap),
  options: [
    { file: 'server/_defaults.ts', origins: ['https://defaults.test'], bodyLimit: 64 },
    { file: 'server/comments.rpc.ts', bodyLimit: 16 },
  ],
}

const whoami = loader(
  'whoami',
  Schema.String,
  Effect.flatMap(Comments, (c) => c.whoami()),
)

const sunk: Cause.Cause<unknown>[] = []
const discovered: { app: DiscoveredApp } = {
  app: {
    controllers: [],
    router: router({
      table: routes({ home: '/' }),
      pages: { home: { loaders: [whoami], render: () => Effect.map(useLoader(whoami), (s) => el('p', {}, s)) } },
      notFound: () => Effect.succeed(el('p', {}, 'missing')),
    }),
    layer: StoreLive,
    services: [comments],
    onError: (cause) => void sunk.push(cause),
  },
}
// Read when `start` loads the app, on its first request.
vi.mock('../discovered', () => ({
  get default() {
    return discovered.app
  },
}))

const origin = 'http://x.test'
const call = (
  app: { fetch: (r: Request) => Promise<Response> },
  id: string,
  body?: string,
  headers: Record<string, string> = {},
) => app.fetch(new Request(`${origin}/_sleek/fn/${id}`, { method: 'POST', body, headers: { origin, ...headers } }))

beforeEach(() => {
  builds = 0
  sunk.length = 0
})

describe('the generated implementation Layer', () => {
  it('build services resolve once, request services and the wrap per call', async () => {
    const app = start()
    const answers = [
      await (await call(app, 'Comments.whoami', undefined, { cookie: 'session=alice' })).json(),
      await (await call(app, 'Comments.whoami', undefined, { cookie: 'session=bob' })).json(),
    ]
    expect([answers, builds]).toEqual([
      [
        { _tag: 'Success', value: 'alice 1' },
        { _tag: 'Success', value: 'bob 1' },
      ],
      1,
    ])
  })

  it("an in-process call from a page's loader runs inside the wrap", async () => {
    const res = await start().fetch(new Request(`${origin}/`, { headers: { cookie: 'session=carol' } }))
    expect(await res.text()).toContain('<p>carol 1</p>')
  })

  it('a typed error crosses the wire as the Exit failure', async () => {
    const res = await call(start(), 'Comments.find', '{"id":"x"}')
    expect([res.status, await res.json()]).toEqual([200, { _tag: 'Failure', error: { _tag: 'Missing', id: 'x' } }])
  })

  it("an undeclared failure is the Server Root's onError and an empty 500; an explicit onError wins", async () => {
    const res = await call(start(), 'Comments.boom')
    expect([res.status, await res.text(), sunk.length]).toEqual([500, '', 1])
    const own: Cause.Cause<unknown>[] = []
    await call(start({ onError: (cause) => void own.push(cause) }), 'Comments.boom')
    expect([own.length, sunk.length]).toEqual([1, 1])
  })
})

describe('the explicit layer over the discovered one', () => {
  it('wins for a Layer File Tag, which the generated Layer reads, and for a generated Tag; each is built once', async () => {
    let own = 0
    const layer = Layer.effect(
      Store,
      Effect.sync(() => ({ build: 100 + ++own })),
    )
    const res = await call(start({ layer }), 'Comments.whoami', undefined, { cookie: 'session=dan' })
    expect([await res.json(), own, builds]).toEqual([{ _tag: 'Success', value: 'dan 101' }, 1, 1])

    const replaced = Layer.succeed(Comments, {
      whoami: () => Effect.succeed('test'),
      find: () => Effect.succeed('found'),
      boom: () => Effect.succeed('fine'),
    })
    const answer = await (await call(start({ layer: replaced }), 'Comments.whoami')).json()
    expect(answer).toEqual({ _tag: 'Success', value: 'test' })
  })

  it('the generated entry listed in services registers once', async () => {
    const res = await call(start({ services: [comments.entry] }), 'Comments.find', '{"id":"y"}')
    expect(res.status).toBe(200)
  })
})

describe('wire configuration', () => {
  const echo = serverFn('echo', { input: Schema.String, success: Schema.String })(function* (s) {
    return s
  })

  it.each([
    ['https://start.test', 'Comments.find', 200],
    ['https://defaults.test', 'Comments.find', 200],
    ['https://other.test', 'Comments.find', 403],
    // An unknown id is refused cross-origin before its lookup, so the answer names no id.
    ['https://other.test', 'Comments.unknown', 403],
    [origin, 'Comments.unknown', 404],
  ])('origins are the union of start and every file: %s calling %s answers %i', async (from, id, status) => {
    const app = start({ origins: ['https://start.test'] })
    const res = await call(app, id, '{"id":"z"}', { origin: from })
    expect([res.status, status === 200 ? 200 : await res.text()]).toEqual([status, status === 200 ? 200 : ''])
  })

  it("bodyLimit resolves per id: the file's own, then start's", async () => {
    const app = start({ bodyLimit: 32, functions: [echo] })
    const sizes = [
      (await call(app, 'Comments.find', '{"id":"12345"}')).status,
      (await call(app, 'Comments.find', '{"id":"123456789"}')).status,
      (await call(app, 'echo', '"a body of twenty-six bytes"')).status,
      (await call(app, 'echo', '"a body well past thirty-two bytes"')).status,
    ]
    expect(sizes).toEqual([200, 413, 200, 413])
  })

  it('a bodyLimit that is not a positive integer fails the app load naming its file', async () => {
    const saved = discovered.app
    discovered.app = { ...saved, services: [{ ...comments, options: [{ file: 'server/bad.rpc.ts', bodyLimit: 0 }] }] }
    try {
      await expect(call(start(), 'Comments.find', '{}')).rejects.toThrow('bodyLimit in server/bad.rpc.ts')
    } finally {
      discovered.app = saved
    }
  })
})
