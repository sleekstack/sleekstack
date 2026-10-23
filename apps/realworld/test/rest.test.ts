import { UnsupportedMediaType } from '@sleekstack/start'
import { Effect, Layer, type ParseResult, Schema } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { DbLive } from '../server/db'
import { TokenSecretLive } from '../server/identity'
import { wrap } from '../server/routes/api/_defaults'

// One in-memory database for this file, set before `server/app` reads it.
vi.hoisted(() => {
  process.env.CONDUIT_DB = ':memory:'
})

const { app } = await import('../server/app')

/** `method path` on the REST facade, with a JSON (or raw string) body and `token` when given. */
const api = async (method: string, path: string, options: { body?: unknown; token?: string; auth?: string } = {}) => {
  const auth = options.auth ?? (options.token && `Token ${options.token}`)
  const response = await app.fetch(
    new Request(`http://conduit.test/api/${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(auth && { authorization: auth }) },
      body:
        options.body === undefined
          ? undefined
          : typeof options.body === 'string'
            ? options.body
            : JSON.stringify(options.body),
    }),
  )
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : undefined }
}

const register = async (name: string) => {
  const { body } = await api('POST', 'users', {
    body: { user: { username: name, email: `${name}@x.io`, password: 'secret1' } },
  })
  return body.user.token as string
}

const ISO = expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/)
const profileOf = (username: string, following = false) => ({ username, bio: null, image: null, following })
const articleShape = (slug: string, author: string) => ({
  slug,
  title: expect.any(String),
  description: expect.any(String),
  body: expect.any(String),
  tagList: expect.any(Array),
  createdAt: ISO,
  updatedAt: ISO,
  favorited: false,
  favoritesCount: 0,
  author: profileOf(author),
})

describe('users and profiles', () => {
  it('register 201, login, current user and update carry the user envelope with the token', async () => {
    const registered = await api('POST', 'users', {
      body: { user: { username: 'ann', email: 'ann@x.io', password: 'secret1' } },
    })
    expect(registered).toEqual({
      status: 201,
      body: { user: { email: 'ann@x.io', token: expect.any(String), username: 'ann', bio: null, image: null } },
    })
    const login = await api('POST', 'users/login', { body: { user: { email: 'ann@x.io', password: 'secret1' } } })
    expect(login.status).toBe(200)
    const token = login.body.user.token
    expect(await api('GET', 'user', { token })).toEqual({ status: 200, body: { user: { ...login.body.user, token } } })
    expect(await api('PUT', 'user', { token, body: { user: { bio: 'hi' } } })).toMatchObject({
      status: 200,
      body: { user: { username: 'ann', bio: 'hi', token } },
    })
  })

  it('maps service errors: blank or taken fields 422, wrong login 403, no token 401', async () => {
    expect(await api('POST', 'users', { body: { user: { username: '', email: 'b@x.io', password: 'p' } } })).toEqual({
      status: 422,
      body: { errors: { username: ["can't be blank"] } },
    })
    await register('bob')
    expect(
      await api('POST', 'users', { body: { user: { username: 'BOB', email: 'other@x.io', password: 'p' } } }),
    ).toEqual({ status: 422, body: { errors: { username: ['has already been taken'] } } })
    expect(await api('POST', 'users/login', { body: { user: { email: 'bob@x.io', password: 'nope' } } })).toEqual({
      status: 403,
      body: { errors: { 'email or password': ['is invalid'] } },
    })
    expect(await api('GET', 'user')).toEqual({ status: 401, body: { errors: { token: ['is missing'] } } })
  })

  it('profiles: anonymous read, follow/unfollow as the viewer, unknown 404, self-follow 422', async () => {
    const cat = await register('cat')
    await register('dan')
    expect(await api('GET', 'profiles/dan')).toEqual({ status: 200, body: { profile: profileOf('dan') } })
    expect(await api('POST', 'profiles/dan/follow', { token: cat })).toEqual({
      status: 200,
      body: { profile: profileOf('dan', true) },
    })
    expect((await api('GET', 'profiles/dan', { token: cat })).body.profile.following).toBe(true)
    expect(await api('DELETE', 'profiles/dan/follow', { token: cat })).toEqual({
      status: 200,
      body: { profile: profileOf('dan') },
    })
    expect(await api('GET', 'profiles/nobody')).toEqual({ status: 404, body: { errors: { profile: ['not found'] } } })
    expect((await api('POST', 'profiles/cat/follow', { token: cat })).status).toBe(422)
  })
})

describe('articles, favorites, comments and tags', () => {
  it('article CRUD, list and feed envelopes', async () => {
    const eve = await register('eve')
    const fay = await register('fay')
    const created = await api('POST', 'articles', {
      token: eve,
      body: { article: { title: 'Hello World', description: 'd', body: 'b', tagList: ['b', 'a'] } },
    })
    expect(created).toEqual({
      status: 201,
      body: { article: { ...articleShape('hello-world', 'eve'), tagList: ['a', 'b'] } },
    })
    expect(await api('GET', 'articles/hello-world')).toEqual({
      status: 200,
      body: { article: created.body.article },
    })
    expect(await api('GET', 'articles?author=eve&limit=1')).toEqual({
      status: 200,
      body: { articles: [created.body.article], articlesCount: 1 },
    })
    await api('POST', 'profiles/eve/follow', { token: fay })
    expect(await api('GET', 'articles/feed', { token: fay })).toMatchObject({ status: 200, body: { articlesCount: 1 } })

    // A new title gives a new slug, carried in the response.
    expect(
      await api('PUT', 'articles/hello-world', { token: eve, body: { article: { title: 'Bye World' } } }),
    ).toMatchObject({ status: 200, body: { article: { slug: 'bye-world', title: 'Bye World', body: 'b' } } })
    expect(await api('PUT', 'articles/bye-world', { token: fay, body: { article: { body: 'x' } } })).toEqual({
      status: 403,
      body: { errors: { article: ['is not yours'] } },
    })
    expect(await api('DELETE', 'articles/bye-world', { token: eve })).toEqual({ status: 204, body: undefined })
    expect(await api('GET', 'articles/bye-world')).toEqual({
      status: 404,
      body: { errors: { article: ['not found'] } },
    })
  })

  it('favorite/unfavorite, comments and tags', async () => {
    const gus = await register('gus')
    await api('POST', 'articles', {
      token: gus,
      body: { article: { title: 'Fav', description: 'd', body: 'b', tagList: ['t'] } },
    })
    expect(await api('POST', 'articles/fav/favorite', { token: gus })).toMatchObject({
      status: 200,
      body: { article: { favorited: true, favoritesCount: 1 } },
    })
    expect(await api('DELETE', 'articles/fav/favorite', { token: gus })).toMatchObject({
      status: 200,
      body: { article: { favorited: false, favoritesCount: 0 } },
    })

    const added = await api('POST', 'articles/fav/comments', { token: gus, body: { comment: { body: 'hi' } } })
    expect(added).toEqual({
      status: 201,
      body: {
        comment: { id: expect.any(Number), createdAt: ISO, updatedAt: ISO, body: 'hi', author: profileOf('gus') },
      },
    })
    expect(await api('GET', 'articles/fav/comments')).toEqual({ status: 200, body: { comments: [added.body.comment] } })
    expect(await api('DELETE', `articles/fav/comments/${added.body.comment.id}`, { token: gus })).toEqual({
      status: 204,
      body: undefined,
    })
    expect(await api('GET', 'articles/fav/comments')).toEqual({ status: 200, body: { comments: [] } })
    expect(await api('GET', 'tags')).toMatchObject({ status: 200, body: { tags: expect.arrayContaining(['t']) } })
  })

  it('an article titled Feed stays reachable: `feed` is the feed route, never a slug', async () => {
    const hal = await register('hal')
    const created = await api('POST', 'articles', {
      token: hal,
      body: { article: { title: 'Feed', description: 'd', body: 'b' } },
    })
    expect(created.body.article.slug).toBe('feed-2')
    expect(await api('GET', `articles/${created.body.article.slug}`)).toMatchObject({
      status: 200,
      body: { article: { title: 'Feed' } },
    })
  })

  it('non-numeric paging is 422', async () => {
    expect(await api('GET', 'articles?limit=abc')).toEqual({
      status: 422,
      body: { errors: { limit: ['must be a number'] } },
    })
  })
})

describe('auth and request errors', () => {
  it('a bad or non-Token Authorization is 401 on every route, optional-auth ones included', async () => {
    for (const path of ['tags', 'articles', 'profiles/ann', 'articles/feed', 'user'])
      for (const auth of ['Token bad.token.here', 'Bearer whatever'])
        expect(await api('GET', path, { auth })).toEqual({ status: 401, body: { errors: { token: ['is invalid'] } } })
  })

  it('anonymous is allowed on optional-auth routes and 401 on required ones', async () => {
    for (const path of ['tags', 'articles', 'profiles/ann']) expect((await api('GET', path)).status).toBe(200)
    for (const [method, path] of [
      ['GET', 'articles/feed'],
      ['POST', 'articles'],
      ['POST', 'profiles/ann/follow'],
    ] as const)
      expect(
        await api(
          method,
          path,
          method === 'POST' ? { body: { article: { title: 't', description: 'd', body: 'b' } } } : {},
        ),
      ).toEqual({
        status: 401,
        body: { errors: { token: ['is missing'] } },
      })
  })

  it('malformed JSON and a missing envelope key are 422', async () => {
    expect(await api('POST', 'users/login', { body: '{not json' })).toEqual({
      status: 422,
      body: { errors: { body: ['is not valid JSON'] } },
    })
    expect(await api('POST', 'users/login', { body: { email: 'a@x.io', password: 'p' } })).toEqual({
      status: 422,
      body: { errors: { user: ['is missing'] } },
    })
  })

  it('a body over 1 MiB is 413, by its declared length or by the bytes streamed; one just under is read', async () => {
    const TOO_LARGE = { status: 413, body: { errors: { body: ['is too large'] } } }
    const login = (email: string) => ({ user: { email, password: 'p' } })
    const big = JSON.stringify(login('x'.repeat(1024 * 1024)))
    expect(await api('POST', 'users/login', { body: big })).toEqual(TOO_LARGE)
    const declared = await app.fetch(
      new Request('http://conduit.test/api/users/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': String(2 * 1024 * 1024) },
        body: '{}',
      }),
    )
    expect([declared.status, await declared.json()]).toEqual([413, TOO_LARGE.body])
    const streamed = await app.fetch(
      new Request('http://conduit.test/api/users/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: new Blob([big]).stream(),
        duplex: 'half',
      } as RequestInit),
    )
    expect([streamed.status, await streamed.json()]).toEqual([413, TOO_LARGE.body])
    const under = JSON.stringify(login('x'.repeat(1024 * 1024 - 100)))
    expect((await api('POST', 'users/login', { body: under })).status).toBe(403)
  })

  it('an unknown route or method under /api/ is 404; other paths pass on', async () => {
    for (const [method, path] of [
      ['GET', 'nope'],
      ['PATCH', 'user'],
      ['GET', 'articles/%E0%A4%A/comments'],
    ] as const)
      expect(await api(method, path)).toEqual({ status: 404, body: { errors: { body: ['not found'] } } })
    expect((await app.fetch(new Request('http://conduit.test/'))).headers.get('content-type')).toMatch(/text\/html/)
  })

  it('/api/ itself is 404', async () => {
    expect(await api('GET', '')).toEqual({ status: 404, body: { errors: { body: ['not found'] } } })
  })

  // An intended difference from the route table: routing runs inside the directory `wrap`, which resolves the viewer
  // first, so a bad token is 401 before an unknown route, method or escape is 404.
  it('a bad token is 401 on an unknown route, method or escape too', async () => {
    for (const [method, path] of [
      ['GET', ''],
      ['GET', 'nope'],
      ['PATCH', 'user'],
      ['GET', 'articles/%E0%A4%A/comments'],
    ] as const)
      expect(await api(method, path, { auth: 'Token bad.token.here' })).toEqual({
        status: 401,
        body: { errors: { token: ['is invalid'] } },
      })
  })

  it('a body without application/json is 415', async () => {
    const response = await app.fetch(
      new Request('http://conduit.test/api/users/login', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ user: { email: 'a@x.io', password: 'p' } }),
      }),
    )
    expect([response.status, await response.json()]).toEqual([415, { errors: { body: ['must be application/json'] } }])
  })

  it('a non-numeric comment id is the JSON 404', async () => {
    expect(await api('DELETE', 'articles/any/comments/abc')).toEqual({
      status: 404,
      body: { errors: { body: ['not found'] } },
    })
  })

  // Intended differences from the route table: Controllers ignore a trailing slash, and a path with an empty segment
  // matches no Controller, so it reaches the page router.
  it('/api/articles/ answers like /api/articles; /api//x reaches the pages', async () => {
    expect(await api('GET', 'articles/')).toEqual(await api('GET', 'articles'))
    const empty = await app.fetch(new Request('http://conduit.test/api//x'))
    expect(empty.headers.get('content-type')).toMatch(/text\/html/)
  })

  it('the directory wrap answers a body without application/json 415, a failed decode 404 (params) or 422', async () => {
    const answer = async (error: UnsupportedMediaType | ParseResult.ParseError) => {
      const request = new Request('http://conduit.test/api/x', { method: 'POST' })
      const response = await Effect.runPromise(
        wrap(Effect.fail(error), request).pipe(Effect.provide(Layer.merge(DbLive(':memory:'), TokenSecretLive))),
      )
      return { status: response.status, body: await response.json() }
    }
    // The decode failure the HTTP face gives: issue paths start at the input part.
    const decodeError = <A, I>(schema: Schema.Schema<A, I>, input: unknown) =>
      Effect.runSync(Effect.flip(Schema.decodeUnknown(schema)(input)))
    expect(await answer(new UnsupportedMediaType())).toEqual({
      status: 415,
      body: { errors: { body: ['must be application/json'] } },
    })
    const Params = Schema.Struct({ params: Schema.Struct({ id: Schema.NumberFromString }) })
    const Body = Schema.Struct({ body: Schema.Struct({ user: Schema.Struct({ email: Schema.String }) }) })
    expect(await answer(decodeError(Params, { params: { id: 'x' } }))).toEqual({
      status: 404,
      body: { errors: { body: ['not found'] } },
    })
    expect(await answer(decodeError(Body, { body: { user: {} } }))).toEqual({
      status: 422,
      body: { errors: { 'user.email': ['is missing'] } },
    })
  })
})
