import { notFound, redirect, router, routes } from '@sleekstack/router'
import { el } from '@sleekstack/ui'
import { Cause, Context, Effect, Exit, Layer } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Cookies, InvalidCookie, Request as RequestTag, ResponseHeaders, start } from '../index'
import { requestServices } from '../services'

class Greeting extends Context.Tag('Greeting')<Greeting, string>() {}

const app = router({
  table: routes({ home: '/', boom: '/boom' }),
  pages: {
    home: { render: () => Effect.map(Greeting, (g) => el('p', {}, g)) },
    boom: { render: () => Effect.die(new Error('page secret')) },
  },
  notFound: () => Effect.succeed(el('p', {}, 'missing')),
})

const log: string[] = []
const errors: Cause.Cause<unknown>[] = []

const server = start({
  router: app,
  layer: Layer.succeed(Greeting, 'hello'),
  onError: (cause) => void errors.push(cause),
  middleware: [
    (req) =>
      Effect.sync(() => {
        log.push('first')
        if (req.headers.has('x-stop')) return new Response('stopped')
      }),
    (req) =>
      Effect.gen(function* () {
        log.push('second')
        if (req.headers.has('x-throw')) throw new Error('middleware secret')
        if (req.headers.has('x-fail')) return yield* Effect.fail('middleware failure')
        if (req.headers.has('x-redirect')) return yield* redirect('/login')
        if (req.headers.has('x-not-found')) return yield* notFound()
      }),
  ],
  handlers: {
    '/api': {
      GET: () => Effect.sync(() => (log.push('handler'), new Response('api'))),
      POST: () => Effect.die(new Error('handler secret')),
    },
    '/cookies': {
      POST: () =>
        Effect.gen(function* () {
          const cookies = yield* Cookies
          yield* cookies.set('session', 'abc', { path: '/', httpOnly: true, sameSite: 'Lax' })
          yield* cookies.delete('old')
          ;(yield* ResponseHeaders).set('x-extra', '1')
          const req = yield* RequestTag
          return new Response(`${req.method} ${cookies.get('session')} ${cookies.get('old')} ${cookies.get('keep')}`)
        }),
    },
  },
})

const call = (path: string, init: RequestInit = {}) => server.fetch(new Request(`http://x.test${path}`, init))

afterEach(() => {
  log.length = 0
  errors.length = 0
  vi.unstubAllEnvs()
})

describe('dispatch', () => {
  it('runs middleware in order, then the handler', async () => {
    expect(await (await call('/api')).text()).toBe('api')
    expect(log).toEqual(['first', 'second', 'handler'])
  })

  it('a middleware Response skips the rest', async () => {
    const res = await call('/api', { headers: { 'x-stop': '1' } })
    expect(await res.text()).toBe('stopped')
    expect(log).toEqual(['first'])
  })

  it('a path without a handler is the router page, with the app layer', async () => {
    const res = await call('/')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<p>hello</p>')
  })

  it("an unmatched path is the router's not-found page with 404", async () => {
    const res = await call('/nope')
    expect(res.status).toBe(404)
    expect(await res.text()).toContain('<p>missing</p>')
  })

  it('an unsupported handler method is 405 with Allow', async () => {
    const res = await call('/api', { method: 'DELETE' })
    expect(res.status).toBe(405)
    expect(res.headers.get('allow')).toBe('GET, POST')
  })

  it.each([
    ['x-redirect', 302, '/login'],
    ['x-not-found', 404, null],
  ])('router control flow from middleware (%s) answers %i', async (header, status, location) => {
    const res = await call('/api', { headers: { [header]: '1' } })
    expect([res.status, res.headers.get('location')]).toEqual([status, location])
    expect(errors).toEqual([])
  })
})

describe('defects', () => {
  it.each([
    ['a throwing middleware', '/api', { headers: { 'x-throw': '1' } }, 'middleware secret'],
    ['a failing middleware', '/api', { headers: { 'x-fail': '1' } }, 'middleware failure'],
    ['a throwing handler', '/api', { method: 'POST' }, 'handler secret'],
    ['a throwing page', '/boom', {}, 'page secret'],
  ])('%s reaches the error sink and answers an empty 500 in production', async (_, path, init, secret) => {
    vi.stubEnv('NODE_ENV', 'production')
    const res = await call(path, init)
    expect(res.status).toBe(500)
    expect(await res.text()).toBe('')
    expect(errors.map((c) => Cause.pretty(c)).join()).toContain(secret)
  })
})

describe('request services', () => {
  it('cookie sets and deletes become Set-Cookie, ResponseHeaders are added', async () => {
    const res = await call('/cookies', { method: 'POST', headers: { cookie: 'old=1; keep=2' } })
    expect(await res.text()).toBe('POST abc undefined 2')
    expect(res.headers.getSetCookie()).toEqual(['session=abc; Path=/; HttpOnly; SameSite=Lax', 'old=; Max-Age=0'])
    expect(res.headers.get('x-extra')).toBe('1')
  })

  it.each([
    ['bad name', 'value', {}, 'name'],
    ['ok', 'semi;colon', {}, 'value'],
    ['ok', 'v', { path: '/; Domain=evil' }, 'path'],
    ['ok', 'v', { domain: 'a;b' }, 'domain'],
    ['ok', 'v', { maxAge: 1.5 }, 'maxAge'],
  ])('set(%j, %j, %j) is an InvalidCookie on its %s', async (name, value, options, part) => {
    const set = Effect.flatMap(Cookies, (c) => c.set(name, value, options))
    const exit = await Effect.runPromiseExit(Effect.provide(set, requestServices(new Request('http://x.test')).layer))
    expect(exit).toEqual(Exit.fail(new InvalidCookie({ name, part: part as InvalidCookie['part'] })))
  })

  it('a test layer replaces the request services', async () => {
    const handler = () => Effect.map(Cookies, (c) => c.get('session'))
    const fake = Layer.succeed(Cookies, {
      get: () => 'test',
      set: () => Effect.void,
      delete: () => Effect.void,
    })
    expect(await Effect.runPromise(Effect.provide(handler(), fake))).toBe('test')
  })
})
