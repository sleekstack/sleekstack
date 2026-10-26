import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { RecordNotFound, RecordRejected } from '@sleekstack/model'
import { Context, Effect, Exit, type Layer } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { recordAdapterLayer } from '../client'

class ArticleAdapter extends Context.Tag('ArticleAdapter')<
  ArticleAdapter,
  {
    readonly find: (id: string) => Effect.Effect<unknown, RecordNotFound | RecordRejected>
    readonly save: (id: string, change: unknown) => Effect.Effect<unknown, RecordNotFound | RecordRejected>
  }
>() {}

const Article = { type: 'article', adapter: ArticleAdapter }
const layer: Layer.Layer<ArticleAdapter> = recordAdapterLayer(Article, '/articles/:id')

const fake = (status: number, body: string, statusText = '') => {
  const f = vi.fn(async (_url: string, _init?: RequestInit) => new Response(body, { status, statusText }))
  vi.stubGlobal('fetch', f)
  return f
}
const run = <A, E>(effect: Effect.Effect<A, E, ArticleAdapter>) => Effect.runPromiseExit(Effect.provide(effect, layer))
const find = (id: string) => run(Effect.flatMap(ArticleAdapter, (a) => a.find(id)))
const save = (id: string, change: unknown) => run(Effect.flatMap(ArticleAdapter, (a) => a.save(id, change)))

afterEach(() => vi.unstubAllGlobals())

describe('recordAdapterLayer', () => {
  it('find GETs the route with the id filled in and answers the JSON object', async () => {
    const f = fake(200, JSON.stringify({ id: '1', title: 'A' }))
    expect(await find('1')).toEqual(Exit.succeed({ id: '1', title: 'A' }))
    expect(f.mock.calls[0]![0]).toBe('/articles/1')
    expect(f.mock.calls[0]![1]!.method).toBe('GET')
  })

  it('save PATCHes the change as JSON', async () => {
    const f = fake(200, JSON.stringify({ id: '1', title: 'B' }))
    expect(await save('1', { title: 'B' })).toEqual(Exit.succeed({ id: '1', title: 'B' }))
    const [url, init] = f.mock.calls[0]!
    expect(url).toBe('/articles/1')
    expect(init).toMatchObject({ method: 'PATCH', headers: { 'content-type': 'application/json' } })
    expect(init!.body).toBe(JSON.stringify({ title: 'B' }))
  })

  it('encodes an id with / or % into one path segment', async () => {
    const f = fake(200, '{}')
    await find('a/b%c')
    expect(f.mock.calls[0]![0]).toBe('/articles/a%2Fb%25c')
  })

  it.each([
    [404, '{}', '', new RecordNotFound({ type: 'article', id: '1' })],
    [
      400,
      JSON.stringify({ message: 'bad' }),
      'Bad Request',
      new RecordRejected({ type: 'article', id: '1', message: 'bad' }),
    ],
    [422, '{}', 'Unprocessable', new RecordRejected({ type: 'article', id: '1', message: 'Unprocessable' })],
  ])('status %i is a typed failure', async (status, body, statusText, error) => {
    fake(status, body, statusText)
    expect(await save('1', {})).toEqual(Exit.fail(error))
  })

  it.each([
    ['401', () => fake(401, '{}')],
    ['500', () => fake(500, '{}')],
    ['an array body', () => fake(200, '[]')],
    ['a non-JSON body', () => fake(200, 'oops')],
    ['a 404 with an array body', () => fake(404, '[]')],
    ['a 400 with a non-JSON body', () => fake(400, 'oops')],
    ['a 422 with an empty body', () => fake(422, '')],
    ['a rejected fetch', () => vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline')))],
  ])('%s is a defect', async (_, setup) => {
    setup()
    const exit = await find('1')
    expect(Exit.isFailure(exit) && exit.cause._tag).toBe('Die')
  })

  it('imports only client-safe modules', () => {
    const source = readFileSync(path.join(__dirname, '..', 'recordsClient.ts'), 'utf8')
    const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1])
    expect(imports).toEqual(['@sleekstack/model', 'effect'])
  })
})
