import { Readable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'

// One in-memory database for this file, set before `server/app` reads it.
vi.hoisted(() => {
  process.env.CONDUIT_DB = ':memory:'
})

const { app, SESSION } = await import('../server/app')
const { devMiddleware } = await import('../server/dev')

const ORIGIN = 'http://conduit.test'

/** Calls server function `id` from the app's own origin, with `cookie` when given. */
const call = async (id: string, input?: unknown, cookie?: string) => {
  const response = await app.fetch(
    new Request(`${ORIGIN}/_sleek/fn/${id}`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json', ...(cookie && { cookie }) },
      body: input === undefined ? undefined : JSON.stringify(input),
    }),
  )
  return { status: response.status, setCookie: response.headers.getSetCookie(), body: await response.json() }
}

/** The `name=value` pair of a `Set-Cookie` line, as the browser sends it back. */
const pair = (setCookie: ReadonlyArray<string>) => setCookie[0]!.split(';')[0]!

const user = (name: string) => ({ username: name, email: `${name}@x.io`, password: 'secret1' })

describe('session cookie', () => {
  it('login sets the HttpOnly session cookie; protected functions need it; logout clears it', async () => {
    await call('users.register', user('ann'))
    const signedIn = await call('users.login', { email: 'ann@x.io', password: 'secret1' })
    expect(signedIn.body).toEqual({
      _tag: 'Success',
      value: { email: 'ann@x.io', username: 'ann', bio: null, image: null },
    })
    expect(signedIn.setCookie).toEqual([
      expect.stringMatching(
        new RegExp(`^${SESSION}=[\\w-]+\\.[\\w-]+\\.[\\w-]+; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax$`),
      ),
    ])
    const cookie = pair(signedIn.setCookie)

    expect((await call('user.current')).body).toEqual({ _tag: 'Failure', error: { _tag: 'Unauthorized' } })
    expect((await call('user.current', undefined, cookie)).body).toMatchObject({ value: { username: 'ann' } })
    expect((await call('user.current', undefined, `${SESSION}=bad.token.here`)).body).toEqual({
      _tag: 'Failure',
      error: { _tag: 'Unauthorized' },
    })

    // A bad cookie is Unauthorized on every function that reads the viewer, an anonymous-friendly one included.
    expect((await call('tags.list', undefined, `${SESSION}=bad.token.here`)).body).toEqual({
      _tag: 'Failure',
      error: { _tag: 'Unauthorized' },
    })

    const out = await call('users.logout', undefined, cookie)
    expect(out.setCookie).toEqual([`${SESSION}=; Path=/; Max-Age=0`])
  })

  it('register signs in; a wrong login is the declared Forbidden', async () => {
    const registered = await call('users.register', user('bea'))
    expect(registered.setCookie).toEqual([expect.stringMatching(new RegExp(`^${SESSION}=`))])
    expect((await call('users.login', { email: 'bea@x.io', password: 'nope' })).body).toEqual({
      _tag: 'Failure',
      error: { _tag: 'Forbidden', errors: { 'email or password': ['is invalid'] } },
    })
  })

  it('articles, comments and profiles run as the cookie viewer; their domain errors cross typed', async () => {
    const author = pair((await call('users.register', user('cal'))).setCookie)
    const reader = pair((await call('users.register', user('dee'))).setCookie)
    const created = await call(
      'articles.create',
      { title: 'Hi there', description: 'd', body: 'b', tagList: ['x'] },
      author,
    )
    expect(created.body).toMatchObject({ _tag: 'Success', value: { slug: 'hi-there', author: { username: 'cal' } } })
    expect((await call('profiles.follow', { username: 'cal' }, reader)).body).toMatchObject({
      value: { following: true },
    })
    expect((await call('articles.feed', {}, reader)).body).toMatchObject({ value: { articlesCount: 1 } })
    expect((await call('comments.add', { slug: 'hi-there', comment: { body: 'nice' } }, reader)).body).toMatchObject({
      value: { body: 'nice', author: { username: 'dee' } },
    })
    expect((await call('articles.delete', { slug: 'hi-there' }, reader)).body).toEqual({
      _tag: 'Failure',
      error: { _tag: 'Forbidden', errors: { article: ['is not yours'] } },
    })
    expect((await call('articles.get', { slug: 'nope' })).body).toEqual({
      _tag: 'Failure',
      error: { _tag: 'NotFound', resource: 'article' },
    })
    expect((await call('tags.list')).body).toEqual({ _tag: 'Success', value: ['x'] })
  })
})

describe('request checks', () => {
  it('a cross-origin call is 403', async () => {
    const response = await app.fetch(
      new Request(`${ORIGIN}/_sleek/fn/tags.list`, { method: 'POST', headers: { origin: 'http://evil.test' } }),
    )
    expect(response.status).toBe(403)
  })

  it('a body over 1 MiB is 413', async () => {
    const response = await app.fetch(
      new Request(`${ORIGIN}/_sleek/fn/users.login`, {
        method: 'POST',
        headers: { origin: ORIGIN },
        body: JSON.stringify({ email: 'x'.repeat(1024 * 1024), password: 'p' }),
      }),
    )
    expect(response.status).toBe(413)
  })
})

describe('dev middleware', () => {
  const host = 'localhost:5173'
  const documentOf = async (url: string) => `<html data-url="${url}"><div id="app"></div></html>`
  const respond = (method: string, url: string, accept: string) =>
    new Promise<{ status?: number; body?: string; next: boolean }>((resolve, reject) => {
      const req = Object.assign(Readable.from([]), { method, url, headers: { host, origin: `http://${host}`, accept } })
      const res = {
        statusCode: 200,
        setHeader: () => res,
        end: (chunk: Buffer) => resolve({ status: res.statusCode, body: chunk.toString(), next: false }),
      }
      devMiddleware(async () => app, documentOf)(req as never, res as never, (error) =>
        error ? reject(error) : resolve({ next: true }),
      )
    })

  it('serves a page navigation server-rendered inside the document', async () => {
    const page = await respond('GET', '/', 'text/html,*/*')
    expect(page.status).toBe(200)
    expect(page.body).toMatch(/^<html data-url="\/"><div id="app">.*conduit.*<\/div><\/html>$/s)
  })

  it('serves /api/ through start and passes modules and assets to Vite', async () => {
    expect(await respond('GET', '/api/tags', 'application/json')).toMatchObject({ next: false, status: 404 })
    expect(await respond('GET', '/src/main.tsx', '*/*')).toEqual({ next: true })
  })
})
