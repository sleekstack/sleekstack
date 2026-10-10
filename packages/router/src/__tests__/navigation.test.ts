// @vitest-environment jsdom
import { Cause, Data, Effect, Schema } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Boundary, el, Pending } from '@sleekstack/ui'
import { jsx as rawJsx } from '@sleekstack/ui/jsx-runtime'
import {
  handle,
  loader,
  type Loader,
  type Navigation,
  notFound,
  params,
  redirect,
  RedirectLoop,
  router,
  routes,
  startRouter,
  useLoader,
} from '../index'

const jsx = (type: any, props: any) => rawJsx(type, props)
const table = routes({
  home: '/',
  user: '/users/:id',
  old: '/old',
  loop: '/loop/:n',
  gone: '/gone',
  broken: '/broken',
  slow: '/slow',
  toBroken: '/to-broken',
  hidden: '/hidden',
  lazy: '/lazy',
})

class Teapot extends Data.TaggedError('Teapot')<{ readonly status: number }> {}
let calls = 0
let stopped = 0
let failures = 0
const user = loader(
  'user',
  Schema.String,
  Effect.flatMap(params(table, 'user'), ({ id }) => Effect.sync(() => (calls++, `user ${id}`))),
)
const old = loader('old', Schema.String, redirect('/users/1'))
const loop = loader(
  'loop',
  Schema.String,
  Effect.flatMap(params(table, 'loop'), ({ n }) => redirect(`/loop/${Number(n) + 1}`)),
)
const gone = loader('gone', Schema.String, notFound())
const broken = loader(
  'broken',
  Schema.String,
  Effect.suspend(() => (failures++, Effect.fail(new Teapot({ status: 418 })))),
)
const toBroken = loader('toBroken', Schema.String, redirect('/broken'))
const slow = loader('slow', Schema.String, Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(() => stopped++))))

const read = (l: Loader<string, string, any, any>) => () =>
  jsx(Boundary, {
    tag: 'Teapot',
    fallback: () => Effect.succeed(el('p', {}, 'error')),
    children: jsx(Pending, { fallback: 'wait', children: Effect.map(useLoader(l), (s) => el('h1', {}, s)) }),
  })
const app = router({
  table,
  pages: {
    home: {
      render: () =>
        jsx('nav', {
          children: [jsx('a', { href: '/users/7', children: 'seven' }), jsx('a', { href: '#top', children: 'top' })],
        }),
    },
    user: { render: read(user), loaders: [user] },
    old: { render: read(old), loaders: [old] },
    loop: { render: read(loop), loaders: [loop] },
    gone: { render: read(gone), loaders: [gone] },
    broken: { render: read(broken), loaders: [broken] },
    slow: { render: read(slow), loaders: [slow] },
    toBroken: { render: read(toBroken), loaders: [toBroken] },
    // Pages reading a loader they do not declare.
    hidden: { render: read(old) },
    lazy: { render: read(slow) },
  },
  notFound: () => Effect.succeed(el('h1', {}, 'not found')),
})

const get = (path: string, opts = {}) => handle(app, new Request(`http://x.test${path}`), opts)

describe('handle', () => {
  afterEach(() => void ((calls = 0), (failures = 0)))

  it.each([
    ['/users/7', 200, 'user 7'],
    ['/nowhere', 404, 'not found'],
    ['/gone', 404, 'not found'],
    ['/broken', 418, '<p>error</p>'],
  ])('%s responds %i with the page', async (path, status, text) => {
    const res = await get(path)
    expect(res.status).toBe(status)
    expect(await res.text()).toContain(text)
  })

  it('sends loader results so the client need not load them, and wraps the document', async () => {
    const res = await get('/users/7', { stream: true, document: { before: '<body>', after: '</body>' } })
    const html = await res.text()
    expect(html).toMatch(/^<body>[\s\S]*data-sleek-hydrate[\s\S]*user 7[\s\S]*<\/body>$/)
    expect(calls).toBe(1)
  })

  it('a loader redirect is a 302 to where the redirects end', async () => {
    const res = await get('/old')
    expect([res.status, res.headers.get('location')]).toEqual([302, '/users/1'])
  })

  it('a failing loader runs once; its status and Boundary come from that run', async () => {
    const res = await get('/broken')
    expect([res.status, failures]).toEqual([418, 1])
  })

  it('a redirect to a failing page is a 302 to it', async () => {
    const res = await get('/to-broken')
    expect([res.status, res.headers.get('location')]).toEqual([302, '/broken'])
  })

  it('an undeclared loader redirects a string render', async () => {
    const res = await get('/hidden')
    expect([res.status, res.headers.get('location')]).toEqual([302, '/users/1'])
  })

  it('streaming sends the shell before a declared slow loader settles', async () => {
    const res = await get('/slow', { stream: true })
    const reader = res.body!.getReader()
    let shell = ''
    while (!shell.includes('</')) shell += new TextDecoder().decode((await reader.read()).value)
    expect([res.status, shell]).toEqual([200, expect.stringContaining('wait')])
    await reader.cancel()
  })

  it.each([
    ['/old', 'location.replace("/users/1")'],
    ['/gone', '<template id="sleek-router-404"><h1>not found</h1></template>'],
  ])('a streamed %s sends its redirect or not-found as a script', async (path, text) => {
    expect(await (await get(path, { stream: true })).text()).toContain(text)
  })

  it('a redirect loop past the bound is a 500 with a RedirectLoop', async () => {
    const errors: Array<unknown> = []
    const res = await get('/loop/0', { onError: (c: Cause.Cause<unknown>) => errors.push(Cause.squash(c)) })
    expect(res.status).toBe(500)
    expect(errors[0]).toBeInstanceOf(RedirectLoop)
  })
})

describe('startRouter', () => {
  let nav: Navigation | undefined
  const container = () => document.body.firstElementChild!
  const flush = () => act(() => new Promise((r) => setTimeout(r, 0)))
  beforeAll(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    window.scrollTo = vi.fn() as never
  })
  afterEach(async () => {
    await act(async () => void (await nav?.dispose()))
    nav = undefined
    stopped = 0
  })
  const start = async (path: string, html = '') => {
    history.replaceState(null, '', path)
    document.body.innerHTML = `<div>${html}</div>`
    await act(async () => void (nav = await startRouter(app, { container: container() })))
  }

  it('hydrates server HTML, follows link clicks, and restores scroll on back', async () => {
    const res = await get('/')
    await start('/', await res.text())
    Object.defineProperty(window, 'scrollY', { value: 120, configurable: true })
    await act(async () => void container().querySelector('a')!.click())
    await flush()
    expect([location.pathname, container().textContent]).toEqual(['/users/7', 'user 7'])
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
    await act(async () => history.back())
    await flush()
    await flush()
    expect([location.pathname, container().querySelector('nav')?.textContent]).toEqual(['/', 'seventop'])
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 120)
    expect(calls).toBe(1) // hydrated from the server's results
    await act(() => nav!.navigate('/users/7'))
    expect(calls).toBe(2) // a navigation loads again
  })

  it('leaves a fragment link of the shown page to the browser', async () => {
    await start('/')
    const a = container().querySelectorAll('a')[1]!
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    vi.mocked(window.scrollTo).mockClear()
    a.dispatchEvent(ev)
    await flush()
    expect(container().querySelector('nav')).not.toBeNull()
    expect([ev.defaultPrevented, location.hash]).toEqual([false, '#top'])
    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  it('a redirect replaces the URL with its target; a not-found shows the not-found page', async () => {
    await start('/old')
    expect([location.pathname, container().textContent]).toEqual(['/users/1', 'user 1'])
    await act(() => nav!.navigate('/gone'))
    expect([location.pathname, container().textContent]).toEqual(['/gone', 'not found'])
  })

  it('the latest navigation wins and the interrupted loads stop', async () => {
    await start('/')
    let first!: Promise<void>
    await act(async () => void (first = nav!.navigate('/slow')))
    await act(() => nav!.navigate('/users/3'))
    await first
    expect(stopped).toBe(1)
    expect([location.pathname, container().textContent]).toEqual(['/users/3', 'user 3'])
  })

  it('an action redirect navigates', async () => {
    const go = { render: () => jsx('form', { action: () => redirect('/users/9'), children: jsx('button', {}) }) }
    const withForm = router({ ...app, table: routes({ ...table, form: '/form' }), pages: { ...app.pages, form: go } })
    history.replaceState(null, '', '/form')
    document.body.innerHTML = '<div></div>'
    await act(async () => void (nav = await startRouter(withForm, { container: container() })))
    await act(async () => void container().querySelector('button')!.click())
    await flush()
    expect([location.pathname, container().textContent]).toEqual(['/users/9', 'user 9'])
  })
})
