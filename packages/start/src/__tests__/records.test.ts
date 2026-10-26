import type { Cause } from 'effect'
import { Context, Data, Effect, Layer, Schema } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { type ControllerEntry, records, recordsMethods, start, type Wrap } from '../index'

// The `@sleekstack/model` error classes, by the same tags.
class RecordNotFound extends Data.TaggedError('RecordNotFound')<{ readonly type: string; readonly id: string }> {}
class RecordRejected extends Data.TaggedError('RecordRejected')<{
  readonly type: string
  readonly id: string
  readonly message: string
}> {}
class Boom extends Data.TaggedError('Boom')<{}> {}

type Wire = { readonly id: string; readonly title: string; readonly createdAt: string }

class Articles extends Context.Tag('Articles')<
  Articles,
  {
    readonly find: (id: string) => Effect.Effect<Wire, RecordNotFound>
    readonly save: (id: string, change: { readonly title: string }) => Effect.Effect<Wire, RecordRejected | Boom>
  }
>() {}

// A record as `defineRecord('article', { fields, adapter })` makes it, with `createdAt` read-only.
const Article = {
  type: 'article',
  schema: Schema.Struct({ id: Schema.String, title: Schema.String, createdAt: Schema.DateFromString }),
  change: Schema.encodedBoundSchema(Schema.Struct({ title: Schema.String })),
  adapter: Articles,
}

const table = new Map<string, Wire>()
const adapter = Layer.succeed(Articles, {
  find: (id) => {
    const row = table.get(id)
    return row ? Effect.succeed(row) : Effect.fail(new RecordNotFound({ type: 'article', id }))
  },
  save: (id, { title }) => {
    if (title === '') return Effect.fail(new RecordRejected({ type: 'article', id, message: 'title is empty' }))
    if (title === 'boom') return Effect.fail(new Boom())
    // A row with no `createdAt`: the answer does not encode.
    if (title === 'broken') return Effect.succeed({ id, title } as Wire)
    const row = { ...table.get(id)!, title }
    table.set(id, row)
    return Effect.succeed(row)
  },
})

// Maps `Boom` to 418; lets every other failure through.
const wrap: Wrap = (next) =>
  Effect.catchIf(
    next,
    (e): e is Boom => e instanceof Boom,
    () => Effect.succeed(new Response(null, { status: 418 })),
  )

const served: ControllerEntry = {
  route: 'articles/[id]',
  pattern: '/articles/:id',
  methods: recordsMethods(records(Article)),
  options: [{ file: 'articles/[id].controller.ts', wrap }],
}

const errors: Cause.Cause<unknown>[] = []
const server = start({ layer: adapter, controllers: [served], onError: (cause) => void errors.push(cause) })

const call = (method: string, body?: unknown, headers: HeadersInit = { 'content-type': 'application/json' }) =>
  server.fetch(
    new Request('http://x.test/articles/1', {
      method,
      ...(body === undefined ? {} : { headers, body: JSON.stringify(body) }),
    }),
  )
const read = async (res: Response) => [res.status, res.headers.get('allow'), await res.text()]

const row: Wire = { id: '1', title: 'a', createdAt: '2026-01-01T00:00:00.000Z' }

afterEach(() => {
  table.clear()
  errors.length = 0
})

describe('records()', () => {
  it('GET answers the wire form', async () => {
    table.set('1', row)
    expect(await read(await call('GET'))).toEqual([200, null, JSON.stringify(row)])
  })

  it('GET of an unknown id is 404 RecordNotFound', async () => {
    expect(await read(await call('GET'))).toEqual([
      404,
      null,
      JSON.stringify({ _tag: 'RecordNotFound', type: 'article', id: '1' }),
    ])
  })

  it('PATCH answers the saved wire form and ignores a read-only key', async () => {
    table.set('1', row)
    const res = await call('PATCH', { title: 'b', createdAt: 'never', id: '2' })
    expect(await read(res)).toEqual([200, null, JSON.stringify({ ...row, title: 'b' })])
  })

  it('PATCH rejected by the adapter is 422 RecordRejected', async () => {
    table.set('1', row)
    expect(await read(await call('PATCH', { title: '' }))).toEqual([
      422,
      null,
      JSON.stringify({ _tag: 'RecordRejected', type: 'article', id: '1', message: 'title is empty' }),
    ])
  })

  it.each([
    ['a body missing an editable field is 400 DecodeError', { other: 1 }, undefined, 400],
    ['a non-JSON content type is 415', { title: 'b' }, { 'content-type': 'text/plain' }, 415],
  ])('%s', async (_, body, headers, status) => {
    table.set('1', row)
    const res = await call('PATCH', body, headers)
    expect(res.status).toBe(status)
    if (status === 400) expect((await res.json())._tag).toBe('DecodeError')
  })

  it('DELETE is 405 with Allow', async () => {
    expect(await read(await call('DELETE'))).toEqual([405, 'GET, HEAD, PATCH, OPTIONS', ''])
  })

  it('another failure reaches wrap unchanged', async () => {
    table.set('1', row)
    expect((await call('PATCH', { title: 'boom' })).status).toBe(418)
  })

  it('an answer that does not encode is a defect: an empty 500 and the error sink', async () => {
    table.set('1', row)
    expect(await read(await call('PATCH', { title: 'broken' }))).toEqual([500, null, ''])
    expect(errors).toHaveLength(1)
  })
})
