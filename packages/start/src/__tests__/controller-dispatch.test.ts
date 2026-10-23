import { router, routes } from '@sleekstack/router'
import { el } from '@sleekstack/ui'
import { Data, Effect, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  type ControllerEntry,
  type ControllerMethodEntry,
  Cookies,
  ResponseHeaders,
  ResponseStatus,
  start,
  type Wrap,
} from '../index'

// One `start` for the file: each call reconfigures the process-wide runtime.

class Conflict extends Data.TaggedError('Conflict')<{}> {}

const entry = (
  pattern: string,
  methods: ControllerEntry['methods'],
  options: ControllerEntry['options'] = [],
): ControllerEntry => ({ route: pattern, pattern, methods, options })

const params = Schema.Record({ key: Schema.String, value: Schema.String })
const echo: ControllerMethodEntry = { params, run: ({ params }) => Effect.succeed(params) }
const answer = (value: unknown): ControllerMethodEntry => ({ run: () => Effect.succeed(value) })

// Maps every failure to a JSON 418 naming it, and marks each answer it runs.
const wrap: Wrap = (next) =>
  Effect.flatMap(ResponseHeaders, (headers) => Effect.sync(() => headers.set('x-wrapped', '1'))).pipe(
    Effect.zipRight(next),
    Effect.catchAll((e: { _tag: string }) => Effect.succeed(Response.json({ error: e._tag }, { status: 418 }))),
  )

let cancelled = false

const server = start({
  router: router({
    table: routes({ item: '/items/:id' }),
    pages: { item: { render: () => Effect.succeed(el('p', {}, 'page')) } },
    notFound: () => Effect.succeed(el('p', {}, 'missing')),
  }),
  handlers: { '/items/h': { GET: () => Effect.succeed(new Response('handler')) } },
  controllers: [
    entry('/items/:id', { GET: echo, PATCH: answer('patched') }),
    entry('/files/*path', { GET: echo }),
    entry('/posts', { POST: answer('posted') }),
    entry('/empty', {}),
    entry('/stream', {
      GET: {
        run: () => Effect.sync(() => new Response(new ReadableStream({ cancel: () => void (cancelled = true) }))),
      },
    }),
    entry('/status/:n', {
      GET: {
        params,
        run: ({ params }) =>
          Effect.gen(function* () {
            yield* ResponseStatus.set(Number(params.n))
            yield* Effect.sleep(params.n === '201' ? '30 millis' : '1 millis')
            return params.n
          }),
      },
    }),
    entry(
      '/wrapped/:id',
      {
        GET: echo,
        POST: {
          run: () =>
            Effect.gen(function* () {
              yield* ResponseStatus.set(201)
              ;(yield* ResponseHeaders).set('x-staged', '1')
              yield* (yield* Cookies).set('staged', '1')
              return yield* new Conflict()
            }),
        },
      },
      [{ file: 'wrapped/_defaults.ts', wrap }],
    ),
  ],
})

const call = (path: string, method = 'GET') => server.fetch(new Request(`http://x.test${path}`, { method }))

describe('Controller dispatch', () => {
  const page = expect.stringContaining('<p>missing</p>')

  it.each([
    ['GET', '/items/a%2Fb', 200, null, '{"id":"a/b"}'],
    ['GET', '/items/%00', 200, null, '{"id":"\\u0000"}'],
    ['GET', '/items/%E0', 404, null, ''],
    ['GET', '/it%E0ms/1', 404, null, page],
    ['GET', '/files/a%2Fb/c', 200, null, '{"path":"a/b/c"}'],
    ['GET', '/files/a/b/c', 200, null, '{"path":"a/b/c"}'],
    ['GET', '/files/a/%zz', 404, null, ''],
    ['GET', '/items/1/', 200, null, '{"id":"1"}'],
    ['GET', '/files//a', 404, null, page],
    ['GET', '/items/h', 200, null, 'handler'],
    ['patch', '/items/1', 200, null, '"patched"'],
    ['HEAD', '/items/1', 200, null, ''],
    ['HEAD', '/posts', 405, 'POST, OPTIONS', ''],
    ['OPTIONS', '/items/1', 204, 'GET, HEAD, PATCH, OPTIONS', ''],
    ['DELETE', '/items/1', 405, 'GET, HEAD, PATCH, OPTIONS', ''],
    ['GET', '/empty', 405, 'OPTIONS', ''],
    ['OPTIONS', '/empty', 204, 'OPTIONS', ''],
  ])('%s %s answers %i (Allow %s)', async (method, path, status, allow, body) => {
    const res = await call(path, method)
    expect([res.status, res.headers.get('allow'), await res.text()]).toEqual([status, allow, body])
  })

  it('HEAD cancels a streaming GET body', async () => {
    const res = await call('/stream', 'HEAD')
    expect([res.status, await res.text(), cancelled]).toEqual([200, '', true])
  })

  it.each([
    ['GET', '/wrapped/%E0', 418, '{"error":"InvalidPathEncoding"}'],
    ['DELETE', '/wrapped/1', 418, '{"error":"MethodNotAllowed"}'],
    ['OPTIONS', '/wrapped/1', 204, ''],
    ['HEAD', '/wrapped/%E0', 418, ''],
  ])('%s %s runs inside wrap, which answers %i', async (method, path, status, body) => {
    const res = await call(path, method)
    expect([res.status, res.headers.get('x-wrapped'), await res.text()]).toEqual([status, '1', body])
  })
})

describe('ResponseStatus', () => {
  it('two concurrent requests keep their own status', async () => {
    const [slow, fast] = await Promise.all([call('/status/201'), call('/status/202')])
    expect([slow.status, fast.status]).toEqual([201, 202])
  })

  it('a status set before a failure is dropped; staged headers and cookies stay', async () => {
    const res = await call('/wrapped/1', 'POST')
    expect([res.status, res.headers.get('x-staged'), res.headers.getSetCookie()]).toEqual([418, '1', ['staged=1']])
    expect(await res.json()).toEqual({ error: 'Conflict' })
  })
})
