// The shell and the auth pages in a browser: each page is server-rendered by the real `start` app, hydrated by
// `startRouter`, and its server function calls go to the same app through `fetch`, which keeps the HttpOnly session
// cookie the way a browser does. The file runs in Node (the server needs `node:sqlite`, which a jsdom-environment
// file cannot import) with a jsdom window installed below.
import { type Navigation, startRouter } from '@sleekstack/router'
import { client } from '@sleekstack/start/client'
import { flush } from '@sleekstack/testing'
import { Layer } from 'effect'
import { act } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { builtinEnvironments } from 'vitest/environments'

// One in-memory database for this file, set before `server/app` reads it.
vi.hoisted(() => {
  process.env.CONDUIT_DB = ':memory:'
})

const { app, SESSION } = await import('../server/app')
const { pages } = await import('../src/app')
const { ServerFunctions } = await import('../src/pages/functions')

/** The browser's cookie jar: the session cookie the app set, sent back on every request. */
let cookie = ''
const keepCookies = (response: Response) => {
  for (const line of response.headers.getSetCookie()) cookie = line.includes('Max-Age=0') ? '' : line.split(';')[0]!
  return response
}

const browser = await builtinEnvironments.jsdom.setup(globalThis, { jsdom: { url: 'http://conduit.test/' } })
afterAll(() => browser.teardown(globalThis))

const calls = vi.fn<(id: string) => void>()
beforeAll(() => {
  window.scrollTo = vi.fn() as never // a navigation scrolls; jsdom has no layout
  vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
    const headers = new Headers(init.headers)
    headers.set('origin', location.origin)
    if (cookie) headers.set('cookie', cookie)
    calls(new URL(input, location.href).pathname)
    return keepCookies(await app.fetch(new Request(new URL(input, location.href), { ...init, headers })))
  })
})

/** The page at `path` as the server answers a navigation to it. */
const serve = (path: string) =>
  app.fetch(new Request(new URL(path, location.origin), { headers: cookie ? { cookie } : {} }))

let nav: Navigation | undefined
let container: HTMLElement
const onError = vi.fn()
afterEach(async () => {
  await act(() => nav?.dispose())
  nav = undefined
  container?.remove()
  cookie = ''
  calls.mockClear()
  onError.mockClear()
})

/** Loads `path` as a browser does: the server's page, hydrated by the router. Returns the page and its header element. */
const open = async (path: string) => {
  const response = await serve(path)
  expect(response.status).toBe(200)
  history.replaceState(null, '', path)
  container = document.body.appendChild(document.createElement('div'))
  const html = await response.text()
  container.innerHTML = html
  const header = container.querySelector('nav')
  nav = await act(() => startRouter(pages, { container, layer: Layer.succeed(ServerFunctions, client), onError }))
  await flush()
  return { html, header }
}

/** Registers `name` from this browser, which then holds their session cookie. */
const signUp = async (name: string) => {
  const body = JSON.stringify({ username: name, email: `${name}@x.io`, password: 'secret1' })
  await fetch('/_sleek/fn/users.register', { method: 'POST', headers: { 'content-type': 'application/json' }, body })
  calls.mockClear()
}

const $ = <E extends Element = HTMLInputElement>(selector: string) => container.querySelector<E>(selector)!
const nav_ = () => [...container.querySelectorAll('nav .nav-link')].map((a) => a.textContent!.trim())
const errors = () => [...container.querySelectorAll('.error-messages li')].map((li) => li.textContent)
const type = (placeholder: string, value: string) => {
  const input = $<HTMLInputElement | HTMLTextAreaElement>(`[placeholder="${placeholder}"]`)
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
/** Submits the form holding `button` and waits until the router or the form settles. */
const submit = async (button: string) => {
  await act(async () => $<HTMLButtonElement>(button).closest('form')!.requestSubmit())
  await flush()
}
const click = async (href: string) => {
  await act(async () => $<HTMLAnchorElement>(`a[href="${href}"]`).click())
  await flush()
}

const ANONYMOUS = ['Home', 'Sign in', 'Sign up']
const signedInAs = (name: string) => ['Home', 'New Article', 'Settings', name]

describe('auth pages', () => {
  it('register, update settings, log out and log in; server errors show inline and the Draft keeps its edits', async () => {
    await open('/register')
    expect(nav_()).toEqual(ANONYMOUS)
    type('Username', 'ann')
    type('Email', 'ann@x.io')
    type('Password', 'secret1')
    await submit('button[type=submit]')
    expect([location.pathname, nav_()]).toEqual(['/', signedInAs('ann')])
    expect(cookie).toMatch(new RegExp(`^${SESSION}=`))

    await click('/settings')
    expect(location.pathname).toBe('/settings')
    expect($('[placeholder="Email"]').value).toBe('ann@x.io')
    type('Short bio about you', 'I write.')
    type('Your Name', 'ann2')
    await submit('.settings-page form button[type=submit]')
    expect([location.pathname, nav_()]).toEqual(['/', signedInAs('ann2')])
    await click('/settings')
    expect($<HTMLTextAreaElement>('textarea').value).toBe('I write.')

    await submit('.btn-outline-danger')
    expect([location.pathname, nav_(), cookie]).toEqual(['/', ANONYMOUS, ''])

    await click('/login')
    type('Email', 'ann@x.io')
    type('Password', 'wrong')
    await submit('button[type=submit]')
    expect([location.pathname, errors()]).toEqual(['/login', ['email or password is invalid']])
    expect($('[placeholder="Email"]').value).toBe('ann@x.io') // the Draft survived the failed submit
    type('Password', 'secret1')
    await submit('button[type=submit]')
    expect([location.pathname, nav_(), errors()]).toEqual(['/', signedInAs('ann2'), []])
    expect(onError).not.toHaveBeenCalled()
  })

  it('a taken username and email come back as one inline list; the fields keep their values', async () => {
    const taken = { username: 'bob', email: 'bob@x.io', password: 'secret1' }
    keepCookies(
      await app.fetch(
        new Request(new URL('/_sleek/fn/users.register', location.origin), {
          method: 'POST',
          headers: { origin: location.origin, 'content-type': 'application/json' },
          body: JSON.stringify(taken),
        }),
      ),
    )
    cookie = '' // registered elsewhere: this browser stays signed out
    await open('/register')
    type('Username', 'bob')
    type('Email', 'bob@x.io')
    type('Password', 'other1')
    await submit('button[type=submit]')
    expect(location.pathname).toBe('/register')
    expect(errors().sort()).toEqual(['email has already been taken', 'username has already been taken'])
    expect([$('[placeholder="Username"]').value, $('[placeholder="Password"]').value]).toEqual(['bob', 'other1'])
    expect(onError).not.toHaveBeenCalled()
  })
})

describe('shell', () => {
  it.each([
    ['anonymous', '', ANONYMOUS],
    ['signed-in', 'cat', signedInAs('cat')],
  ])('the %s header renders on the server and hydrates as it is, with no viewer call', async (_, name, links) => {
    if (name) await signUp(name)
    const token = cookie.split('=')[1]
    const { html, header } = await open('/')
    expect(container.querySelector('nav')).toBe(header) // the server's DOM was adopted, not replaced
    expect(nav_()).toEqual(links)
    expect(calls).not.toHaveBeenCalled() // the viewer came with the page
    if (token) expect(html).not.toContain(token) // the session stays in its HttpOnly cookie
    expect(onError).not.toHaveBeenCalled()
  })

  it.each(['/feed', '/settings', '/editor', '/editor/a-slug'])(
    '%s sends an anonymous visitor to /login',
    async (path) => {
      const response = await serve(path)
      expect([response.status, response.headers.get('location')]).toEqual([302, '/login'])
    },
  )

  it('in the browser, /settings sends a signed-out viewer to /login and lets a signed-in one in', async () => {
    await open('/')
    await act(() => nav!.navigate('/settings'))
    await flush()
    expect(location.pathname).toBe('/login')
    await act(() => nav!.dispose())
    container.remove()

    await signUp('dan')
    await open('/')
    await act(() => nav!.navigate('/settings'))
    await flush()
    expect([location.pathname, $('[placeholder="Your Name"]').value]).toEqual(['/settings', 'dan'])
  })

  it('a path no route matches is a 404 page', async () => {
    const response = await serve('/nowhere')
    expect([response.status, (await response.text()).includes('Page not found')]).toEqual([404, true])
  })
})
