import { notFound, redirect } from '@sleekstack/router'
import { Cause, Effect, ParseResult, Schema } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { type ControllerEntry, type ControllerMethodEntry, ResponseStatus, start, type Wrap } from '../index'

// One `start` for the file: each call reconfigures the process-wide runtime.

const entry = (
  pattern: string,
  methods: ControllerEntry['methods'],
  options: ControllerEntry['options'] = [],
): ControllerEntry => ({ route: pattern, pattern, methods, options })

// The string codecs `printSchema` (`@sleekstack/ui-vite`) gives a printed `number` and `boolean` path or query value.
const NumberCodec = Schema.transform(Schema.String.pipe(Schema.pattern(/^-?\d+(\.\d+)?$/)), Schema.Finite, {
  strict: true,
  decode: Number,
  encode: String,
})
const BooleanCodec = Schema.BooleanFromString

const Title = Schema.Struct({ title: Schema.String })
const echoInput: ControllerMethodEntry['run'] = (input) => Effect.succeed(input)
const post = (method: Partial<ControllerMethodEntry> = {}): ControllerMethodEntry => ({
  body: Title,
  run: ({ body }) => Effect.succeed(body),
  ...method,
})

// `ResponseStatus.set(n)` from the path's `n`, then `value`.
const answer = (value: () => unknown): ControllerMethodEntry => ({
  params: Schema.Struct({ n: NumberCodec }),
  run: ({ params }) => Effect.as(ResponseStatus.set(params.n), value()),
})

const log: string[] = []
const mark =
  (name: string): Wrap =>
  (next) =>
    Effect.zipRight(
      Effect.sync(() => log.push(name)),
      next,
    )
// Maps a decode failure to 422; lets every other failure through.
const unprocessable: Wrap = (next) =>
  Effect.catchIf(next, ParseResult.isParseError, () => Effect.succeed(new Response(null, { status: 422 })))

const errors: Cause.Cause<unknown>[] = []

const server = start({
  onError: (cause) => void errors.push(cause),
  controllers: [
    entry('/users/:id', {
      GET: {
        params: Schema.Struct({ id: NumberCodec }),
        query: Schema.Struct({
          tag: Schema.optional(Schema.Array(Schema.String)),
          page: Schema.optional(NumberCodec),
          draft: Schema.optional(BooleanCodec),
        }),
        run: echoInput,
      },
    }),
    entry('/docs/:slug?', { GET: { params: Schema.Struct({ slug: Schema.optional(Schema.String) }), run: echoInput } }),
    entry('/files/*path', { GET: { params: Schema.Struct({ path: Schema.String }), run: echoInput } }),
    entry('/echo', { POST: post() }),
    entry('/posts', {
      POST: post({ success: Title, run: ({ body }) => Effect.succeed({ ...body, secret: 'not sent' }) }),
    }),
    entry('/value/:n', { GET: answer(() => ({ ok: true })) }),
    entry('/undefined/:n', { GET: answer(() => undefined) }),
    entry('/void', { GET: { run: () => Effect.void } }),
    entry('/null', { GET: { run: () => Effect.succeed(null) } }),
    entry('/response', {
      GET: { run: () => Effect.as(ResponseStatus.set(201), new Response('raw', { status: 202 })) },
    }),
    entry('/bad-encode', {
      GET: { success: Schema.Struct({ n: Schema.Number }), run: () => Effect.succeed({ n: 'not a number' }) },
    }),
    entry(
      '/wrapped/:n',
      {
        GET: {
          params: Schema.Struct({ n: NumberCodec }),
          run: ({ params }) =>
            params.n === 302
              ? redirect('/login')
              : params.n === 404
                ? notFound()
                : Effect.sync(() => void log.push('method')),
        },
      },
      [
        { file: '_defaults.ts', wrap: mark('outer') },
        { file: 'wrapped/_defaults.ts', wrap: unprocessable },
        { file: 'wrapped/[n].controller.ts', wrap: mark('own') },
      ],
    ),
    entry('/limit/own', { POST: post() }, [
      { file: 'limit/_defaults.ts', bodyLimit: 16 },
      { file: 'limit/own.controller.ts', bodyLimit: 32 },
    ]),
    entry('/limit/nearest', { POST: post() }, [
      { file: '_defaults.ts', bodyLimit: 64 },
      { file: 'limit/_defaults.ts', bodyLimit: 16 },
    ]),
    entry('/limit/unread', { POST: { run: () => Effect.succeed('unread') } }, [
      { file: 'limit/_defaults.ts', bodyLimit: 16 },
    ]),
  ],
})

const call = (path: string, init: RequestInit = {}) => server.fetch(new Request(`http://x.test${path}`, init))
const json = (path: string, body: BodyInit, headers: HeadersInit = { 'content-type': 'application/json' }) =>
  call(path, { method: 'POST', headers, body })
const read = async (res: Response) => [res.status, await res.text()]
const title = (length: number) => JSON.stringify({ title: 'x'.repeat(length - '{"title":""}'.length) })
const issue = (path: ReadonlyArray<string>, message: string) => ({ _tag: 'DecodeError', issues: [{ path, message }] })

afterEach(() => {
  log.length = 0
  errors.length = 0
})

describe('Controller decode', () => {
  it.each([
    ['/users/7', { params: { id: 7 }, query: {} }],
    [
      '/users/7?tag=a&tag=b&page=2&page=3&draft=true',
      { params: { id: 7 }, query: { tag: ['a', 'b'], page: 3, draft: true } },
    ],
    ['/users/-1.5?tag=a&draft=false&other=1', { params: { id: -1.5 }, query: { tag: ['a'], draft: false } }],
    ['/docs', { params: {} }],
    ['/docs/a%20b', { params: { slug: 'a b' } }],
    ['/files/a/b%2Fc/d', { params: { path: 'a/b/c/d' } }],
  ])('GET %s decodes to %j', async (path, input) => {
    const res = await call(path)
    expect([res.status, await res.json()]).toEqual([200, input])
  })

  it.each([
    ['/users/x', ['params.id']],
    ['/users/1e3', ['params.id']],
    ['/users/x?draft=1&page=0x1', ['params.id', 'query.page', 'query.draft']],
  ])('GET %s fails decode with every issue: an unhandled 400 DecodeError at %j', async (path, paths) => {
    const res = await call(path)
    const body: { _tag: string; issues: Array<{ path: string[] }> } = await res.json()
    const at = new Set(body.issues.map((i) => i.path.join('.')))
    expect([res.status, body._tag, [...at]]).toEqual([400, 'DecodeError', paths])
  })

  it.each([
    ['application/json; charset=utf-8', '{"title":"a","extra":1}', 200, { title: 'a' }],
    ['APPLICATION/JSON', '{"title":"a"}', 200, { title: 'a' }],
    [null, '{"title":"a"}', 415, ''],
    ['text/plain', '{"title":"a"}', 415, ''],
    ['application/x-www-form-urlencoded', 'title=a', 415, ''],
    ['application/json', '{not json', 400, issue(['body'], 'is not valid JSON')],
    ['application/json', '', 400, issue(['body'], 'is missing')],
    ['application/json', '{}', 400, issue(['body', 'title'], 'is missing')],
  ])('POST with content type %j and body %j answers %i', async (type, body, status, out) => {
    const res = await json('/echo', body, type ? { 'content-type': type } : {})
    const text = await res.text()
    expect([res.status, text && JSON.parse(text)]).toEqual([status, out])
  })

  it('a body over 1 MiB is 413, by its declared length or by the bytes streamed; one just under is read', async () => {
    const MiB = 1024 * 1024
    const declared = await json('/echo', '{}', {
      'content-type': 'application/json',
      'content-length': String(2 * MiB),
    })
    const streamed = await call('/echo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: new Blob([title(MiB + 1)]).stream(),
      duplex: 'half',
    } as RequestInit)
    const under = await json('/echo', title(MiB - 100))
    expect([declared.status, streamed.status, under.status]).toEqual([413, 413, 200])
  })

  it.each([
    ['/limit/own', 24, 200],
    ['/limit/own', 40, 413],
    ['/limit/nearest', 24, 413],
  ])('POST %s with a %i-byte body answers %i: the most specific bodyLimit applies', async (path, size, status) => {
    expect((await json(path, title(size))).status).toBe(status)
  })

  it('a method that declares no body leaves it unread, past any bodyLimit', async () => {
    expect(await read(await json('/limit/unread', title(40), { 'content-type': 'text/plain' }))).toEqual([
      200,
      '"unread"',
    ])
  })
})

describe('Controller encode', () => {
  it.each([
    ['/value/200', 200, '{"ok":true}'],
    ['/value/201', 201, '{"ok":true}'],
    ['/value/404', 404, '{"ok":true}'],
    ['/value/204', 204, ''],
    ['/value/205', 205, ''],
    ['/value/304', 304, ''],
    ['/undefined/200', 200, ''],
    ['/undefined/201', 201, ''],
    ['/void', 204, ''],
    ['/null', 200, 'null'],
    ['/response', 202, 'raw'],
  ])('GET %s answers %i with body %j', async (path, status, body) => {
    expect(await read(await call(path))).toEqual([status, body])
  })

  it('a written success Schema encodes the value: fields outside it are not sent', async () => {
    expect(await read(await json('/posts', '{"title":"a"}'))).toEqual([200, '{"title":"a"}'])
  })

  it('an encode failure is a defect: the error sink and an empty 500', async () => {
    expect(await read(await call('/bad-encode'))).toEqual([500, ''])
    expect(errors.map((c) => Cause.pretty(c)).join()).toContain('not a number')
  })
})

describe('Controller wrap', () => {
  it('wraps compose outer first around decode, method and encode', async () => {
    expect(await read(await call('/wrapped/1'))).toEqual([204, ''])
    expect(log).toEqual(['outer', 'own', 'method'])
  })

  it('a decode failure reaches wrap', async () => {
    expect((await call('/wrapped/x')).status).toBe(422)
    expect(log).toEqual(['outer', 'own'])
  })

  it.each([
    ['/wrapped/302', 302, '/login'],
    ['/wrapped/404', 404, null],
  ])('a Redirect or NotFound wrap lets through answers as control flow: %s is %i', async (path, status, location) => {
    const res = await call(path)
    expect([res.status, res.headers.get('location'), errors]).toEqual([status, location, []])
  })
})
