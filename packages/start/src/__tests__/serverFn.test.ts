import { NotFound, notFound, Redirect, redirect, router, routes } from '@sleekstack/router'
import { el } from '@sleekstack/ui'
import { Cause, Context, Effect, Exit, Layer, Schema } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Cookies, DecodeError, DuplicateServerFn, InvalidServerFnId, serverFn, start } from '../index'
import { decodeResult } from '../wire'

class Greeting extends Context.Tag('Greeting')<Greeting, string>() {}
class NameTaken extends Schema.TaggedError<NameTaken>()('NameTaken', { name: Schema.String }) {}

let ran = 0
const rename = serverFn('profile.rename', {
  input: Schema.Struct({ name: Schema.NonEmptyString, age: Schema.NumberFromString }),
  success: Schema.Struct({ greeting: Schema.String, age: Schema.Number }),
  error: NameTaken,
})(function* ({ name, age }) {
  ran++
  if (name === 'taken') return yield* new NameTaken({ name })
  if (name === 'undeclared') return yield* Effect.fail(new Error('undeclared secret') as never)
  if (name === 'defect') return yield* Effect.die(new Error('defect secret'))
  if (name === 'redirect') return yield* redirect('/login')
  if (name === 'missing') return yield* notFound()
  const greeting = yield* Greeting
  const session = (yield* Cookies).get('session')
  const out = { greeting: `${greeting} ${name} ${session}`, age, secret: 'not serialized' }
  return out
})

const ping = serverFn('ping', { input: Schema.Void, success: Schema.Void })(function* () {})

const app = router({
  table: routes({ home: '/' }),
  pages: { home: { render: () => Effect.succeed(el('p', {}, 'home')) } },
  notFound: () => Effect.succeed(el('p', {}, 'missing')),
})

const errors: Cause.Cause<unknown>[] = []

const server = start({
  router: app,
  layer: Layer.succeed(Greeting, 'hello'),
  functions: [rename, ping],
  origins: ['https://allowed.test'],
  bodyLimit: 64,
  onError: (cause) => void errors.push(cause),
})

const origin = 'http://x.test'
const call = (body: string, init: RequestInit = {}, id = 'profile.rename') =>
  server.fetch(
    new Request(`${origin}/_sleek/fn/${id}`, {
      method: 'POST',
      body,
      ...init,
      headers: { origin, cookie: 'session=s1', ...init.headers },
    }),
  )
const send = (input: unknown) => call(JSON.stringify(input))

afterEach(() => {
  ran = 0
  errors.length = 0
  vi.unstubAllEnvs()
})

describe('round trip', () => {
  it('success: the body runs in the Request Scope and the value is encoded with the success Schema', async () => {
    const res = await send({ name: 'ada', age: '36' })
    expect(res.status).toBe(200)
    // `secret` is outside the success Schema, so it is not serialized.
    const body = await res.json()
    expect(body).toEqual({ _tag: 'Success', value: { greeting: 'hello ada s1', age: 36 } })
    expect(await Effect.runPromise(decodeResult(rename, body))).toEqual({ greeting: 'hello ada s1', age: 36 })
  })

  it('a void function round-trips: no body in, no value out', async () => {
    const res = await call('', {}, 'ping')
    const body = await res.json()
    expect([res.status, body]).toEqual([200, { _tag: 'Success' }])
    expect(await Effect.runPromiseExit(decodeResult(ping, body))).toEqual(Exit.void)
  })

  it('a declared typed failure crosses the wire typed', async () => {
    const res = await send({ name: 'taken', age: '1' })
    const body = await res.json()
    expect([res.status, body]).toEqual([200, { _tag: 'Failure', error: { _tag: 'NameTaken', name: 'taken' } }])
    expect(await Effect.runPromiseExit(decodeResult(rename, body))).toEqual(Exit.fail(new NameTaken({ name: 'taken' })))
  })

  it.each([
    ['an undeclared failure', 'undeclared', 'undeclared secret'],
    ['a defect', 'defect', 'defect secret'],
  ])('%s is an opaque 500 and reaches the error sink', async (_, name, secret) => {
    vi.stubEnv('NODE_ENV', 'production')
    const res = await send({ name, age: '1' })
    expect([res.status, await res.text()]).toEqual([500, ''])
    expect(errors.map((c) => Cause.pretty(c)).join()).toContain(secret)
  })

  it('invalid input is a 400 DecodeError with field-level issues, and the body does not run', async () => {
    const res = await send({ name: '', age: 'x' })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body._tag).toBe('DecodeError')
    expect(body.issues.map((i: { path: unknown }) => i.path)).toEqual([['name'], ['age']])
    expect(ran).toBe(0)
    const exit = await Effect.runPromiseExit(decodeResult(rename, body))
    expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBeInstanceOf(DecodeError)
  })
})

describe('control flow', () => {
  it.each([
    ['redirect', 302, { _tag: 'Redirect', to: '/login' }, new Redirect({ to: '/login' })],
    ['missing', 404, { _tag: 'NotFound' }, new NotFound()],
  ])('%s answers %i and decodes to the router value', async (name, status, envelope, value) => {
    const res = await send({ name, age: '1' })
    const body = await res.json()
    expect([res.status, res.headers.get('location'), body]).toEqual([status, null, envelope])
    const exit = await Effect.runPromiseExit(decodeResult(rename, body))
    expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toEqual(value)
    expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBeInstanceOf(value.constructor)
    expect(errors).toEqual([])
  })

  it('an unknown envelope is a DecodeError', async () => {
    const exit = await Effect.runPromiseExit(decodeResult(rename, { _tag: 'Teleport', to: '/' }))
    expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBeInstanceOf(DecodeError)
  })
})

describe('wire checks', () => {
  const valid = JSON.stringify({ name: 'ada', age: '1' })

  it.each([
    ['a non-POST method is 405', () => call('', { method: 'GET', body: null }), 405],
    ['an unknown id is 404', () => call(valid, {}, 'nope'), 404],
    ['malformed JSON is 400', () => call('{oops'), 400],
    ['a body over the limit is 413', () => call(JSON.stringify({ name: 'a'.repeat(100), age: '1' })), 413],
    ['a cross-origin call is 403', () => call(valid, { headers: { origin: 'https://evil.test' } }), 403],
  ])('%s', async (_, request, status) => {
    const res = await request()
    expect(res.status).toBe(status)
    expect(ran).toBe(0)
  })

  it('405 names POST in Allow', async () => {
    expect((await call('', { method: 'GET', body: null })).headers.get('allow')).toBe('POST')
  })

  it('404 lists no ids', async () => {
    expect(await (await call(valid, {}, 'nope')).text()).toBe('')
  })

  it('malformed JSON is a DecodeError body', async () => {
    expect((await (await call('{oops')).json())._tag).toBe('DecodeError')
  })

  it.each([
    ['an allowed origin passes', { origin: 'https://allowed.test' }, 200],
    ['no Origin on a same-origin fetch passes', { origin: '', 'sec-fetch-site': 'same-origin' }, 200],
    ['no Origin on a cross-site fetch is 403', { origin: '', 'sec-fetch-site': 'cross-site' }, 403],
    ['no Origin and no Sec-Fetch-Site is 403', { origin: '' }, 403],
  ])('%s', async (_, headers, status) => {
    const request = new Request(`${origin}/_sleek/fn/profile.rename`, { method: 'POST', body: valid, headers })
    if (headers.origin === '') request.headers.delete('origin')
    expect((await server.fetch(request)).status).toBe(status)
  })
})

describe('registry', () => {
  const fn = (id: string) => serverFn(id, { input: Schema.Void, success: Schema.Void })(function* () {})

  const thrown = (f: () => unknown): unknown => {
    try {
      f()
    } catch (e) {
      return e
    }
  }

  it('a duplicate id fails at start with DuplicateServerFn', () => {
    const e = thrown(() => start({ router: app, functions: [fn('a'), fn('a')] }))
    expect([e instanceof DuplicateServerFn, e]).toEqual([true, expect.objectContaining({ id: 'a' })])
  })

  it.each(['', 'a/b', '.hidden', 'a b', '..'])('id %j fails at start with InvalidServerFnId', (id) => {
    const e = thrown(() => start({ router: app, functions: [fn(id)] }))
    expect([e instanceof InvalidServerFnId, e]).toEqual([true, expect.objectContaining({ id })])
  })

  it('a server function is directly callable with decoded input', async () => {
    const value = await Effect.runPromise(
      Effect.provide(rename({ name: 'x', age: 2 }), [
        Layer.succeed(Greeting, 'hi'),
        Layer.succeed(Cookies, { get: () => 'c', set: () => Effect.void, delete: () => Effect.void }),
      ]),
    )
    expect(value).toMatchObject({ greeting: 'hi x c', age: 2 })
  })
})
