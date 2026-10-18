// The article page, its comments and the editor in a browser: pages are server-rendered by the real `start` app and
// hydrated by `startRouter`; server function calls go to the same app through `fetch`, which keeps the session cookie.
// Node environment with a jsdom window installed below, as in auth.test.ts (`node:sqlite`).
import { type Navigation, startRouter } from '@sleekstack/router'
import { client } from '@sleekstack/start/client'
import { flush } from '@sleekstack/testing'
import { Layer } from 'effect'
import { act } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { builtinEnvironments } from 'vitest/environments'

vi.hoisted(() => {
  process.env.CONDUIT_DB = ':memory:'
})

const { app } = await import('../server/app')
const { pages } = await import('../src/app')
const { QueriesLive } = await import('../src/layers')
const { ServerFunctions } = await import('../src/pages/functions')

const browser = await builtinEnvironments.jsdom.setup(globalThis, { jsdom: { url: 'http://conduit.test/' } })
afterAll(() => browser.teardown(globalThis))

/** This browser's session cookie. */
let cookie = ''
/** Every function the browser calls, by id. */
const calls = vi.fn<(id: string) => void>()
/** When set, a browser call waits for it before reaching the server. */
let gate: Promise<void> | undefined

beforeAll(() => {
  window.scrollTo = vi.fn() as never
  vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
    const headers = new Headers(init.headers)
    headers.set('origin', location.origin)
    if (cookie) headers.set('cookie', cookie)
    const url = new URL(input, location.href)
    calls(url.pathname.replace('/_sleek/fn/', ''))
    await gate
    return app.fetch(new Request(url, { ...init, headers }))
  })
})

/** Calls server function `id` as the holder of `session` (another browser), straight on the app; returns its result. */
const call = async (id: string, input: unknown, session = '') => {
  const response = await app.fetch(
    new Request(new URL(`/_sleek/fn/${id}`, location.origin), {
      method: 'POST',
      headers: { origin: location.origin, 'content-type': 'application/json', ...(session && { cookie: session }) },
      body: JSON.stringify(input),
    }),
  )
  return { response, result: await response.json() }
}
const fn = async (id: string, input: unknown, session = '') => {
  const { response, result } = await call(id, input, session)
  expect([response.status, result._tag]).toEqual([200, 'Success'])
  return { session: response.headers.getSetCookie()[0]?.split(';')[0] ?? session, value: result.value }
}

let n = 0
/** Registers a fresh user; returns their name and session cookie. */
const user = async () => {
  const name = `a${++n}`
  const { session } = await fn('users.register', { username: name, email: `${name}@x.io`, password: 'secret1' })
  return { name, session }
}
const post = async (session: string, title: string, body = 'b', tagList: string[] = []) =>
  (await fn('articles.create', { title, description: `about ${title}`, body, tagList }, session)).value.slug as string
const comment = (session: string, slug: string, body: string) =>
  fn('comments.add', { slug, comment: { body } }, session)

let nav: Navigation | undefined
let container: HTMLElement
const onError = vi.fn()
afterEach(async () => {
  gate = undefined
  await act(() => nav?.dispose())
  nav = undefined
  container?.remove()
  cookie = ''
  calls.mockClear()
  expect(onError).not.toHaveBeenCalled()
})

const serve = (path: string) =>
  app.fetch(new Request(new URL(path, location.origin), { headers: cookie ? { cookie } : {} }))

/** Loads `path` as a browser does: the server's page, hydrated by the router. */
const open = async (path: string) => {
  const response = await serve(path)
  expect(response.status).toBe(200)
  history.replaceState(null, '', path)
  container = document.body.appendChild(document.createElement('div'))
  container.innerHTML = await response.text()
  nav = await act(() =>
    startRouter(pages, { container, layer: Layer.merge(QueriesLive, Layer.succeed(ServerFunctions, client)), onError }),
  )
  await flush()
}

const $ = <E extends Element = HTMLElement>(selector: string) => container.querySelector<E>(selector)
const all = (selector: string) => [...container.querySelectorAll(selector)].map((e) => e.textContent!.trim())
const comments = () => all('.card .card-text')
const settle = async (run: () => unknown) => {
  await act(async () => void run())
  await flush()
}
const submit = (selector: string) => settle(() => $(selector)!.closest('form')!.requestSubmit())
const type = (selector: string, value: string) =>
  settle(() => {
    const field = $<HTMLInputElement | HTMLTextAreaElement>(selector)!
    field.value = value
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
const enter = (selector: string) =>
  settle(() => $(selector)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))

describe('article page', () => {
  it('anonymous: server-rendered with the markdown body and comments newest first, hydrated with no call', async () => {
    const [writer, reader] = [await user(), await user()]
    const slug = await post(writer.session, 'Read me', '## Part\n\nSome *em* <script>x</script>', ['dragons'])
    await comment(writer.session, slug, 'first')
    await comment(reader.session, slug, 'second')
    await open(`/article/${slug}`)
    expect([all('.banner h1'), all('.article-content h2'), all('.article-content em')]).toEqual([
      ['Read me'],
      ['Part'],
      ['em'],
    ])
    expect([$('.article-content script'), all('.article-content p')[0]]).toEqual([null, 'Some em <script>x</script>'])
    expect(all('.article-content .tag-list li')).toEqual(['dragons'])
    expect(comments()).toEqual(['second', 'first'])
    // Follow and Favorite are sign-in links; no comment form and no delete buttons.
    expect([...container.querySelectorAll('.article-meta a.btn')].map((a) => a.getAttribute('href'))).toEqual([
      '/login',
      '/login',
    ])
    expect([$('.comment-form'), $('.mod-options'), $('.delete-article')]).toEqual([null, null, null])
    expect(all('.col-md-8 p:not(.card-text)')).toEqual(['Sign in or sign up to add comments on this article.'])
    expect(calls).not.toHaveBeenCalled()
  })

  it('another user: Follow and Favorite, a comment posted first, and delete only on their own comment', async () => {
    const [writer, reader] = [await user(), await user()]
    const slug = await post(writer.session, 'Discuss')
    await comment(writer.session, slug, "the writer's")
    cookie = reader.session
    await open(`/article/${slug}`)
    expect([$('.delete-article'), all('.article-meta .follow button')]).toEqual([null, [`Follow ${writer.name}`]])
    await submit('.article-meta .favorite button')
    expect(all('.article-meta .favorite button')).toEqual(['1'])

    await type('.comment-form textarea', 'my reply')
    let release!: () => void
    gate = new Promise((r) => (release = r))
    await act(async () => $<HTMLFormElement>('form.comment-form')!.requestSubmit()) // no flush: the call waits
    // Text typed while posting would be dropped when the success clears the Draft: the field is read-only meanwhile.
    expect($<HTMLTextAreaElement>('.comment-form textarea')!.matches(':disabled')).toBe(true)
    await settle(release)
    expect(comments()).toEqual(['my reply', "the writer's"])
    expect($<HTMLTextAreaElement>('.comment-form textarea')!.value).toBe('')
    // Only the reader's own comment has a delete button.
    expect(container.querySelectorAll('.mod-options').length).toBe(1)
    expect($('.card:first-of-type .mod-options')).not.toBeNull()

    await submit('.mod-options button')
    expect([comments(), $('.mod-options')]).toEqual([["the writer's"], null])
    expect((await fn('comments.list', { slug })).value.map((c: { body: string }) => c.body)).toEqual(["the writer's"])
  })

  it('a blank comment shows the server error and posts nothing', async () => {
    const [writer, reader] = [await user(), await user()]
    const slug = await post(writer.session, 'Quiet')
    cookie = reader.session
    await open(`/article/${slug}`)
    await submit('.comment-form button')
    expect([all('.error-messages li'), comments()]).toEqual([["body can't be blank"], []])
  })

  it('the author: Edit and Delete; Delete lands on / and the article is gone', async () => {
    const writer = await user()
    const slug = await post(writer.session, 'Doomed')
    cookie = writer.session
    await open(`/article/${slug}`)
    expect([$('.article-meta .follow'), $('.article-meta .favorite')]).toEqual([null, null])
    expect($('.article-meta a.btn')!.getAttribute('href')).toBe(`/editor/${slug}`)
    await submit('.delete-article button')
    expect(location.pathname).toBe('/')
    const { result } = await call('articles.get', { slug })
    expect(result.error?._tag).toBe('NotFound')
  })

  it('an unknown article is the 404 page', async () => {
    const response = await serve('/article/no-such-article')
    expect([response.status, (await response.text()).includes('Page not found')]).toEqual([404, true])
  })
})

describe('editor', () => {
  it('creates an article with tags added by Enter, and lands on it', async () => {
    const writer = await user()
    cookie = writer.session
    await open('/editor')
    await type('input[placeholder="Article Title"]', 'Fresh ink')
    await type(`input[placeholder="What's this article about?"]`, 'news')
    await type('textarea', '# Hello')
    for (const tag of ['one', 'two', 'one']) {
      await type('.tag-input', tag)
      await enter('.tag-input')
    }
    expect([all('.tag-list .tag-pill'), $<HTMLInputElement>('.tag-input')!.value, location.pathname]).toEqual([
      ['one', 'two'],
      '',
      '/editor',
    ])
    await settle(() => $('[aria-label="Remove one"]')!.click())
    expect(all('.tag-list .tag-pill')).toEqual(['two'])

    await submit('button[type="submit"]')
    expect(location.pathname).toBe('/article/fresh-ink')
    expect([all('.banner h1'), all('.article-content h1'), all('.article-content .tag-list li')]).toEqual([
      ['Fresh ink'],
      ['Hello'],
      ['two'],
    ])
  })

  it('blank required fields show the server errors and keep the edits', async () => {
    const writer = await user()
    cookie = writer.session
    await open('/editor')
    await type('textarea', 'kept')
    await submit('button[type="submit"]')
    expect(all('.error-messages li')).toEqual(expect.arrayContaining(["title can't be blank"]))
    expect([location.pathname, $<HTMLTextAreaElement>('textarea')!.value]).toEqual(['/editor', 'kept'])
  })

  it("the author edits: the form holds the article's values and a new title lands on the new slug", async () => {
    const writer = await user()
    const slug = await post(writer.session, 'Old title', 'old body', ['keep'])
    cookie = writer.session
    await open(`/editor/${slug}`)
    expect([
      $<HTMLInputElement>('input[placeholder="Article Title"]')!.value,
      $<HTMLTextAreaElement>('textarea')!.value,
      all('.tag-list .tag-pill'),
    ]).toEqual(['Old title', 'old body', ['keep']])
    await type('input[placeholder="Article Title"]', 'New title')
    await submit('button[type="submit"]')
    expect([location.pathname, all('.banner h1')]).toEqual(['/article/new-title', ['New title']])
  })

  it("another user's edit page sends them to the article, on the server and in the browser", async () => {
    const [writer, other] = [await user(), await user()]
    const slug = await post(writer.session, 'Not yours')
    cookie = other.session
    const response = await serve(`/editor/${slug}`)
    expect([response.status, response.headers.get('location')]).toEqual([302, `/article/${slug}`])

    await open('/')
    await settle(() => nav!.navigate(`/editor/${slug}`))
    expect([location.pathname, all('.banner h1')]).toEqual([`/article/${slug}`, ['Not yours']])
  })
})
