// The home feeds, the tag tab, pagination, favorites and the profile pages in a browser: pages are server-rendered by the
// real `start` app and hydrated by `startRouter`; server function calls go to the same app through `fetch`, which keeps
// the session cookie. Node environment with a jsdom window installed below, as in auth.test.ts (`node:sqlite`).
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

/** Calls server function `id` as the holder of `session` (another browser), straight on the app. */
const fn = async (id: string, input: unknown, session = '') => {
  const response = await app.fetch(
    new Request(new URL(`/_sleek/fn/${id}`, location.origin), {
      method: 'POST',
      headers: { origin: location.origin, 'content-type': 'application/json', ...(session && { cookie: session }) },
      body: JSON.stringify(input),
    }),
  )
  const result = await response.json()
  expect([response.status, result._tag]).toEqual([200, 'Success'])
  return { session: response.headers.getSetCookie()[0]?.split(';')[0] ?? session, value: result.value }
}

let n = 0
/** Registers a fresh user; returns their name and session cookie. */
const user = async () => {
  const name = `u${++n}`
  const { session } = await fn('users.register', { username: name, email: `${name}@x.io`, password: 'secret1' })
  return { name, session }
}
const post = (session: string, title: string, tagList: string[] = []) =>
  fn('articles.create', { title, description: `about ${title}`, body: 'b', tagList }, session)

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

const all = (selector: string) => [...container.querySelectorAll(selector)].map((e) => e.textContent!.trim())
const titles = () => all('.article-preview h1')
const tabs = () => all('.feed-toggle .nav-link')
const activeTab = () => all('.nav-pills .nav-link.active')
const hearts = () => all('.article-preview .favorite button, .article-preview a.btn')
const act_ = async (run: () => unknown) => {
  await act(async () => void run())
  await flush()
}
const click = (selector: string) => act_(() => container.querySelector<HTMLElement>(selector)!.click())
const submit = (selector: string) =>
  act_(() => container.querySelector<HTMLElement>(selector)!.closest('form')!.requestSubmit())

describe('home feeds', () => {
  it('anonymous: the Global Feed, server-rendered with the tags and hydrated with no call; Home is /', async () => {
    const a = await user()
    await post(a.session, 'Anon one', ['dragons'])
    await open('/')
    expect([tabs(), activeTab()]).toEqual([['Global Feed'], ['Global Feed']])
    expect(titles()).toContain('Anon one')
    expect(all('.sidebar .tag-list a')).toContain('dragons')
    expect(container.querySelector('.navbar-brand')!.getAttribute('href')).toBe('/')
    expect(hearts()[0]).toBe('0')
    expect(container.querySelector('.article-preview a.btn')!.getAttribute('href')).toBe('/login')
    expect(calls).not.toHaveBeenCalled()
  })

  it('signed in: Home is Your Feed, listing followed authors only, or the empty state', async () => {
    const [writer, reader] = [await user(), await user()]
    await post(writer.session, 'Followed post')
    cookie = reader.session
    await open('/feed')
    expect([tabs(), activeTab()]).toEqual([['Your Feed', 'Global Feed'], ['Your Feed']])
    expect(container.querySelector('.navbar-brand')!.getAttribute('href')).toBe('/feed')
    expect(all('.article-preview')).toEqual(['No articles are here... yet.'])

    await fn('profiles.follow', { username: writer.name }, reader.session)
    await act_(() => nav!.navigate('/'))
    await act_(() => nav!.navigate('/feed'))
    expect(titles()).toEqual(['Followed post'])
  })

  it('the tag tab lists only articles with the tag', async () => {
    const a = await user()
    await post(a.session, 'Tagged', ['wyverns'])
    await post(a.session, 'Untagged')
    await open('/tag/wyverns')
    expect([tabs(), activeTab()]).toEqual([['Global Feed', '#wyverns'], ['#wyverns']])
    expect(titles()).toEqual(['Tagged'])
    await click('.sidebar a[href="/tag/wyverns"]')
    expect(location.pathname).toBe('/tag/wyverns')
  })

  it("hovering a tag prefetches its route's loaders; following it then makes no call", async () => {
    const a = await user()
    await post(a.session, 'Hovered', ['hover'])
    await open('/')
    const tag = '.sidebar a[href="/tag/hover"]'
    await act_(() => container.querySelector(tag)!.dispatchEvent(new MouseEvent('mouseenter')))
    expect(calls).toHaveBeenCalledWith('articles.list')
    calls.mockClear()
    await click(tag)
    expect([location.pathname, titles(), calls.mock.calls]).toEqual(['/tag/hover', ['Hovered'], []])
  })

  it('picking a page fetches it; a route change resets to the first page', async () => {
    const a = await user()
    for (let i = 1; i <= 12; i++) await post(a.session, `Paged ${i}`, ['paged'])
    await open('/tag/paged')
    expect([titles().length, titles()[0], all('.pagination .page-link')]).toEqual([10, 'Paged 12', ['1', '2']])

    await click('.pagination li:nth-child(2) .page-link')
    expect(calls).toHaveBeenCalledWith('articles.list')
    expect([titles(), all('.pagination .active')]).toEqual([['Paged 2', 'Paged 1'], ['2']])

    await act_(() => nav!.navigate('/'))
    await act_(() => nav!.navigate('/tag/paged'))
    expect([titles().length, all('.pagination .active')]).toEqual([10, ['1']])
  })

  it('a favorite made on page 1 still shows after a round trip to page 2', async () => {
    const [writer, fan] = [await user(), await user()]
    let last = ''
    for (let i = 1; i <= 11; i++) last = (await post(writer.session, `Trip ${i}`, ['trip'])).value.slug
    cookie = fan.session
    await open('/tag/trip')
    await submit('.favorite button')
    await click('.pagination li:nth-child(2) .page-link')
    await click('.pagination li:nth-child(1) .page-link')
    expect([titles()[0], hearts()[0]]).toEqual(['Trip 11', '1'])
    await submit('.favorite button') // unfavorites: the button knows it is favorited
    expect((await fn('articles.get', { slug: last }, fan.session)).value.favorited).toBe(false)
  })

  it('favoriting shows the new count at once and keeps the server answer', async () => {
    const [writer, fan] = [await user(), await user()]
    await post(writer.session, 'Liked', ['liked'])
    cookie = fan.session
    await open('/tag/liked')
    await submit('.favorite button')
    expect(hearts()).toEqual(['1'])
    expect(container.querySelector('.favorite button')!.className).toContain('btn-primary')
    await submit('.favorite button')
    expect(hearts()).toEqual(['0'])
  })

  it('a favorite the server refuses rolls back', async () => {
    const [writer, fan] = [await user(), await user()]
    const { value } = await post(writer.session, 'Doomed', ['doomed'])
    cookie = fan.session
    await open('/tag/doomed')
    await fn('articles.delete', { slug: value.slug }, writer.session) // the favorite will be a NotFound
    let release!: () => void
    gate = new Promise((r) => (release = r))
    await act(async () => container.querySelector<HTMLFormElement>('form.favorite')!.requestSubmit()) // no flush: the call waits
    expect(hearts()).toEqual(['1'])
    await act_(release)
    expect(hearts()).toEqual(['0'])
    expect(container.querySelector('.favorite button')!.className).toContain('btn-outline-primary')
  })
})

describe('profile pages', () => {
  it("another user's profile: their articles, their favorites, and a follow button that toggles", async () => {
    const [writer, reader] = [await user(), await user()]
    const { value } = await post(reader.session, 'Reader post')
    await post(writer.session, 'Writer post')
    await fn('articles.favorite', { slug: value.slug }, writer.session)
    cookie = reader.session
    await open(`/profile/${writer.name}`)
    expect([all('.user-info h4'), titles(), activeTab()]).toEqual([[writer.name], ['Writer post'], ['My Articles']])

    await submit('.follow button')
    expect(all('.follow button')).toEqual([`Unfollow ${writer.name}`])
    expect((await fn('profiles.get', { username: writer.name }, reader.session)).value.following).toBe(true)
    await submit('.follow button')
    expect(all('.follow button')).toEqual([`Follow ${writer.name}`])

    await click(`a[href="/profile/${writer.name}/favorites"]`)
    expect([location.pathname, titles(), activeTab()]).toEqual([
      `/profile/${writer.name}/favorites`,
      ['Reader post'],
      ['Favorited Articles'],
    ])
  })

  it('your own profile links to the settings instead of a follow button', async () => {
    const me = await user()
    cookie = me.session
    await open(`/profile/${me.name}`)
    expect([all('.user-info .action-btn'), container.querySelector('.follow')]).toEqual([
      ['Edit Profile Settings'],
      null,
    ])
  })

  it('an unknown user is the 404 page', async () => {
    const response = await serve('/profile/nobody-here')
    expect([response.status, (await response.text()).includes('Page not found')]).toEqual([404, true])
  })
})
