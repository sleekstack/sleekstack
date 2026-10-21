import { loader, router, routes, useLoader } from '@sleekstack/router'
import { el } from '@sleekstack/ui'
import { Effect, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  Cookies,
  implement,
  InvalidCookie,
  Request as RequestTag,
  ResponseHeaders,
  serverFn,
  ServerService,
  type ServerServiceEntry,
  start,
  taggedError,
} from '../index'

class Session extends ServerService('Session')<
  Session,
  {
    readonly login: (input: { readonly value: string }) => Effect.Effect<void, InvalidCookie>
    readonly whoami: () => Effect.Effect<string>
  }
>() {}

const invalidCookie = taggedError(InvalidCookie, {
  name: Schema.String,
  part: Schema.Literal('name', 'value', 'path', 'domain', 'maxAge', 'expires'),
})

const entry: ServerServiceEntry<Session, Session['Type']> = {
  tag: Session,
  methods: {
    login: { input: Schema.Struct({ value: Schema.String }), success: Schema.Void, error: invalidCookie },
    whoami: { input: Schema.Void, success: Schema.String },
  },
}

const SessionLive = implement(Session, {
  login: ({ value }) =>
    Effect.gen(function* () {
      yield* (yield* Cookies).set('session', value, { path: '/' })
      ;(yield* ResponseHeaders).set('x-login', value)
    }),
  whoami: () =>
    Effect.gen(function* () {
      const request = yield* RequestTag
      return `${(yield* Cookies).get('session')} via ${request.method}`
    }),
})

// The same cookie write as a Server Function, for the InvalidCookie comparison.
const loginFn = serverFn('login', {
  input: Schema.Struct({ value: Schema.String }),
  success: Schema.Void,
  error: invalidCookie,
})(function* ({ value }) {
  yield* (yield* Cookies).set('session', value, { path: '/' })
})

const loggedIn = loader(
  'loggedIn',
  Schema.String,
  Effect.gen(function* () {
    const session = yield* Session
    yield* session.login({ value: 'from-loader' })
    return yield* session.whoami()
  }),
)

const app = router({
  table: routes({ home: '/' }),
  pages: { home: { loaders: [loggedIn], render: () => Effect.map(useLoader(loggedIn), (s) => el('p', {}, s)) } },
  notFound: () => Effect.succeed(el('p', {}, 'missing')),
})

const server = start({ router: app, layer: SessionLive, services: [entry], functions: [loginFn] })

const origin = 'http://x.test'
const call = (id: string, body?: string, headers: Record<string, string> = {}) =>
  server.fetch(new Request(`${origin}/_sleek/fn/${id}`, { method: 'POST', body, headers: { origin, ...headers } }))

describe('implement on the wire', () => {
  it("a method's cookie write is Set-Cookie on the response, with its ResponseHeaders", async () => {
    const res = await call('Session.login', '{"value":"abc"}')
    expect([res.status, res.headers.getSetCookie(), res.headers.get('x-login')]).toEqual([
      200,
      ['session=abc; Path=/'],
      'abc',
    ])
  })

  it("a method reads the request's cookie and the request", async () => {
    const res = await call('Session.whoami', undefined, { cookie: 'session=s1' })
    expect(await res.json()).toEqual({ _tag: 'Success', value: 's1 via POST' })
  })

  it('a cookie value outside the grammar fails as InvalidCookie does for a Server Function', async () => {
    const answer = async (res: Response) => [res.status, res.headers.getSetCookie(), await res.json()]
    const fromService = await answer(await call('Session.login', '{"value":"a b"}'))
    expect(fromService).toEqual(await answer(await call('login', '{"value":"a b"}')))
    expect(fromService).toEqual([
      200,
      [],
      { _tag: 'Failure', error: { _tag: 'InvalidCookie', name: 'session', part: 'value' } },
    ])
  })
})

describe('implement in process', () => {
  it("a page loader's call sets the cookie and ResponseHeaders on the page response", async () => {
    const res = await server.fetch(new Request(`${origin}/`))
    expect(await res.text()).toContain('<p>from-loader via GET</p>')
    expect([res.headers.getSetCookie(), res.headers.get('x-login')]).toEqual([
      ['session=from-loader; Path=/'],
      'from-loader',
    ])
  })
})
