// @vitest-environment jsdom
import { Atom } from '@sleekstack/core'
import { Cause, Data, Effect, Schema } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Boundary, el, Head, useAtomValue, useSetAtom } from '@sleekstack/ui'
import { jsx as rawJsx } from '@sleekstack/ui/jsx-runtime'
import {
  handle,
  Link,
  loader,
  type Loader,
  type Navigation,
  notFound,
  params,
  redirect,
  RedirectLoop,
  router,
  type Router,
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
  hiddenGone: '/hidden-gone',
  titled: '/titled',
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
    children: Effect.map(useLoader(l), (s) => el('h1', {}, s)),
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
    slow: { render: read(slow), loaders: [slow], fallback: 'wait' },
    toBroken: { render: read(toBroken), loaders: [toBroken] },
    // Pages reading a loader they do not declare.
    hidden: { render: read(old) },
    // No manual `Pending`: the router wraps the page with its `fallback`.
    lazy: { render: read(slow), fallback: 'wait' },
    hiddenGone: { render: read(gone) },
    titled: { render: () => jsx(Head, { children: jsx('title', { children: 'Titled' }) }) },
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

  // A streamed page is under the router's `Pending`, so its head arrives after the shell as a patch (ADR 0044).
  it.each([
    [false, /^<head><title>Titled<\/title><\/head><body>/],
    [true, /^<head><\/head><body>[\s\S]*__sleekHead\(\[\[\["title"\],\["title",\{\},"Titled"\]\]\]\)/],
  ])("gives a before function the page's Head tags (stream: %s)", async (stream, expected) => {
    const document = { before: (head: string) => `<head>${head}</head><body>`, after: '</body>' }
    expect(await (await get('/titled', { stream, document })).text()).toMatch(expected)
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

  it('streaming sends the shell before an undeclared slow loader settles', async () => {
    const res = await get('/lazy', { stream: true })
    const reader = res.body!.getReader()
    let shell = ''
    while (!shell.includes('wait')) shell += new TextDecoder().decode((await reader.read()).value)
    expect([res.status, shell]).toEqual([200, expect.stringContaining('wait')])
    await reader.cancel()
  })

  it.each([
    ['/hidden', 'location.replace("/users/1")'],
    ['/hidden-gone', '<template id="sleek-router-404"><h1>not found</h1></template>'],
  ])('a streamed %s sends its redirect or not-found as a script', async (path, text) => {
    expect(await (await get(path, { stream: true })).text()).toContain(text)
  })

  it.each([
    ['/broken', 418],
    ['/old', 302],
    ['/gone', 404],
    ['/loop/0', 500],
  ])('streaming %s settles its declared loaders first: %i', async (path, status) => {
    expect((await get(path, { stream: true, onError: () => {} })).status).toBe(status)
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
  const start = async (path: string, html = '', r: Router<any, any> = app) => {
    history.replaceState(null, '', path)
    document.body.innerHTML = `<div>${html}</div>`
    await act(async () => void (nav = await startRouter(r, { container: container() })))
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

  it('hydrates a page rendered at /users/9 when opened at /users/9/ without reloading (prerendered, trailing slash)', async () => {
    const before = calls
    const res = await get('/users/9')
    await start('/users/9/', await res.text())
    expect([container().textContent, calls - before]).toEqual(['user 9', 1])
    await act(() => nav!.navigate('/users/9'))
    expect([container().textContent, calls - before]).toEqual(['user 9', 2]) // the hydrated result is not reused
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

  it("shows the page's fallback while a loader it reads is pending, with no manual Pending", async () => {
    await start('/')
    await act(() => nav!.navigate('/lazy'))
    expect([location.pathname, container().textContent]).toEqual(['/lazy', 'wait'])
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

  describe('the page being left', () => {
    // Pages that re-render on an atom write and read one loader; `bump` writes the atom of the page last rendered.
    const tick = Atom.make(0)
    let bump: (n: number) => void = () => {}
    let guards = 0
    let out = false
    const guard = loader(
      'guard',
      Schema.String,
      Effect.suspend(() => (guards++, out ? redirect('/') : Effect.succeed('in'))),
    )
    let fresh = 0
    let gate = Promise.resolve()
    const gated = loader(
      'gated',
      Schema.String,
      Effect.promise(() => gate.then(() => `v${++fresh}`)),
    )
    const away = loader('away', Schema.String, Effect.zipRight(Effect.yieldNow(), redirect('/users/1')))
    const watch = (l: Loader<string, string, any, any>) => () =>
      jsx(
        () =>
          Effect.gen(function* () {
            const n = yield* useAtomValue(tick)
            bump = yield* useSetAtom(tick)
            return el('h1', {}, `${yield* useLoader(l)} ${n}`)
          }),
        {},
      )
    const hop: { render: () => unknown; loaders?: ReadonlyArray<Loader<any, any, any, any>> } = {
      render: read(guard),
      loaders: [guard, away],
    }
    const links = () =>
      jsx('nav', {
        children: ['/users/7', '/users/8'].map((href) => jsx(Link, { href, table, loaders: [user], children: href })),
      })
    const watching = router({
      ...app,
      table: routes({ ...table, guarded: '/guarded', same: '/same', hop: '/hop', links: '/links' }),
      pages: {
        ...app.pages,
        user: { render: watch(user), loaders: [user] },
        guarded: { render: watch(guard), loaders: [guard] },
        same: { render: watch(gated), loaders: [gated] },
        hop: hop as never,
        links: { render: links },
      },
    })

    it.each([
      ['/users/1', () => calls],
      ['/guarded', () => guards],
    ])(
      're-renders at %s from its held results while the next page loads: no loader, no redirect',
      async (path, count) => {
        out = false
        await start(path, '', watching)
        const before = count()
        out = true
        await act(async () => void nav!.navigate('/slow'))
        await act(async () => bump(1))
        await flush()
        expect([count() - before, location.pathname, container().textContent]).toEqual([
          0,
          path,
          expect.stringMatching(/ 1$/),
        ])
      },
    )

    it('a navigation to the shown pathname loads it fresh; the page being left keeps its value until the swap', async () => {
      fresh = 0
      gate = Promise.resolve()
      await start('/same', '', watching)
      let open!: () => void
      gate = new Promise((r) => (open = r))
      let done!: Promise<void>
      await act(async () => void (done = nav!.navigate('/same?tab=2')))
      await act(async () => bump(1))
      await flush()
      expect(container().textContent).toBe('v1 1')
      open()
      await act(() => done)
      expect([location.search, container().textContent, fresh]).toEqual(['?tab=2', 'v2 0', 2])
      await act(async () => history.back())
      await flush()
      await flush()
      expect([location.search, container().textContent, fresh]).toEqual(['', 'v3 0', 3])
    })

    it("after a redirect, an intermediate hop's results are dropped: an undeclared read there loads again", async () => {
      out = false
      guards = 0
      hop.loaders = [guard, away]
      await start('/', '', watching)
      await act(() => nav!.navigate('/hop'))
      expect([location.pathname, guards]).toEqual(['/users/1', 1])
      hop.loaders = []
      await act(() => nav!.navigate('/hop'))
      expect([location.pathname, container().textContent, guards]).toEqual(['/hop', 'in', 2])
    })

    it('a prefetch of the next page serves it; an unread prefetch survives other navigations', async () => {
      await start('/links', '', watching)
      const before = calls
      for (const a of container().querySelectorAll('a')) a.dispatchEvent(new MouseEvent('mouseenter'))
      await flush()
      await act(() => nav!.navigate('/users/7'))
      await act(() => nav!.navigate('/users/8'))
      expect([container().textContent, calls - before]).toEqual(['user 8 0', 2])
    })

    it("a failed loader of the shown page is replayed once to the page's Boundary", async () => {
      await start('/')
      const before = failures
      await act(() => nav!.navigate('/broken'))
      expect([container().textContent, failures - before]).toEqual(['error', 1])
    })
  })
})
