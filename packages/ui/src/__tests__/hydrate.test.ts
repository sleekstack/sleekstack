// @vitest-environment jsdom
import { Atom } from '@sleekstack/core'
import { Cause, Context, Effect, Layer, Schema } from 'effect'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { bind, Boundary, el, HydrateConflict, HydrationMismatch, hydrateMount, mount, type Mounted, renderToString, useAtomValue, useLocal } from '../index'
import { jsx as rawJsx } from '../jsx-runtime'

const jsx = (type: any, props: any) => rawJsx(type, props)
const tick = () => new Promise((r) => setTimeout(r, 0))

let handles: Array<Mounted> = []
beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})
afterEach(async () => {
  await act(async () => {
    for (const h of handles) await h.dispose()
  })
  handles = []
})

const all = (root: Element): Array<globalThis.Node> => {
  const out: Array<globalThis.Node> = []
  const walk = (n: globalThis.Node) => n.childNodes.forEach((c) => (out.push(c), walk(c)))
  walk(root)
  return out
}

// Server-renders `app`, parses it into a container, and hydrates the same app there.
const serverThenHydrate = async (app: () => any) => {
  const container = document.createElement('div')
  container.innerHTML = await renderToString(app(), { layer: Layer.empty })
  const before = all(container).filter((n) => !(n.nodeType === 8))
  const onError = vi.fn()
  let h!: Mounted
  await act(async () => void (h = await hydrateMount(app(), { layer: Layer.empty, container, onError })))
  handles.push(h)
  expect(onError).not.toHaveBeenCalled()
  return { container, before }
}

describe('hydrateMount', () => {
  it('keeps every server DOM node, runs each component once, and wires onClick + useLocal at once', async () => {
    const runs = { counter: 0, label: 0 }
    const flag = Atom.make('x')
    const Label = () => (runs.label++, Effect.flatMap(useAtomValue(flag), (f) => jsx('i', { children: ['a', f, 'b'] })))
    const Counter = () =>
      Effect.flatMap(
        Effect.sync(() => runs.counter++),
        () => Effect.flatMap(useLocal(0), ([n, set]) => jsx('button', { onClick: () => set(n + 1), children: `n=${n}` })),
      )
    const App = () => jsx('div', { class: 'app', children: [jsx(Label, {}), jsx(Counter, {})] })

    const { container, before } = await serverThenHydrate(() => jsx(App, {}))
    // Server rendered each component once; hydration once more.
    expect(runs).toEqual({ counter: 2, label: 2 })
    expect(all(container)).toEqual(before)
    expect(container.querySelector('i')!.childNodes).toHaveLength(3)

    const button = container.querySelector('button')!
    await act(async () => button.click())
    await act(tick)
    expect(button.textContent).toBe('n=1')
    expect(container.querySelector('button')).toBe(button)
    expect(runs.label).toBe(2)
  })

  it('a second hydrateMount on one container rejects with HydrateConflict without running the app', async () => {
    let runs = 0
    const App = () => (runs++, jsx('p', { children: 'hi' }))
    const { container } = await serverThenHydrate(() => jsx(App, {}))
    runs = 0
    await expect(hydrateMount(jsx(App, {}), { layer: Layer.empty, container })).rejects.toBeInstanceOf(HydrateConflict)
    expect(runs).toBe(0)
    expect(container.innerHTML).toBe('<p>hi</p>')
  })

  it('mount then hydrateMount rejects with HydrateConflict; hydrateMount then mount replaces the content', async () => {
    const container = document.createElement('div')
    let m!: Mounted
    await act(async () => void (m = await mount(jsx('p', { children: 'a' }), { layer: Layer.empty, container })))
    handles.push(m)
    await expect(hydrateMount(jsx('p', { children: 'a' }), { layer: Layer.empty, container })).rejects.toMatchObject({ _tag: 'HydrateConflict' })

    const { container: c2 } = await serverThenHydrate(() => jsx('p', { children: 'a' }))
    await act(async () => void handles.push(await mount(jsx('b', { children: 'z' }), { layer: Layer.empty, container: c2 })))
    expect(c2.innerHTML).toBe('<b>z</b>')
  })

  it('a sleek-bind element unwraps to its server text node', async () => {
    const count = Atom.serializable(Atom.make(3), { key: 'count', schema: Schema.Number })
    const app = () => Effect.succeed(el('p', {}, bind(count, 'n')))
    const { container } = await serverThenHydrate(app)
    expect(container.innerHTML).toBe('<p>3</p>')
  })
})

class Greeting extends Context.Tag('Greeting')<Greeting, string>() {}
class Boom extends Error {
  readonly _tag = 'Boom'
}

// Hydrates `server` markup (optionally mutated) with `client`; returns the mismatches reported and a fresh client render.
const mismatchCase = async (opts: { server: () => any; client: () => any; serverLayer?: Layer.Layer<any>; clientLayer?: Layer.Layer<any>; html?: (h: string) => string; mutate?: (c: Element) => void }) => {
  const container = document.createElement('div')
  const html = await renderToString(opts.server(), { layer: opts.serverLayer ?? Layer.empty })
  container.innerHTML = opts.html ? opts.html(html) : html
  opts.mutate?.(container)
  const onError = vi.fn()
  await act(async () => void handles.push(await hydrateMount(opts.client(), { layer: (opts.clientLayer ?? Layer.empty) as any, container, onError })))
  const fresh = document.createElement('div')
  await act(async () => void handles.push(await mount(opts.client(), { layer: (opts.clientLayer ?? Layer.empty) as any, container: fresh, onError: () => {} })))
  const errors = onError.mock.calls.map(([c]) => Cause.squash(c))
  return { container, fresh, errors, mismatches: errors.filter((e) => e instanceof HydrationMismatch) }
}

describe('hydrateMount mismatch', () => {
  it('a non-deterministic render reports one HydrationMismatch and the DOM equals a client render', async () => {
    let n = 0
    const app = () => jsx('div', { children: [jsx('b', { children: 'same' }), jsx('i', { children: `t${n++}` })] })
    const { container, fresh, mismatches } = await mismatchCase({ server: app, client: app })
    expect(mismatches).toHaveLength(1)
    expect(mismatches[0]).toMatchObject({ _tag: 'HydrationMismatch', expected: 'Text', found: '#text' })
    expect(container.innerHTML).toBe(fresh.innerHTML.replace('t2', 't1'))
  })

  it('a differing client Layer is a mismatch only when the output differs', async () => {
    const App = () => Effect.map(Greeting, (g) => el('p', {}, g))
    const same = await mismatchCase({ server: () => jsx(App, {}), client: () => jsx(App, {}), serverLayer: Layer.succeed(Greeting, 'hi'), clientLayer: Layer.succeed(Greeting, 'hi') })
    expect(same.errors).toEqual([])
    const differ = await mismatchCase({ server: () => jsx(App, {}), client: () => jsx(App, {}), serverLayer: Layer.succeed(Greeting, 'hi'), clientLayer: Layer.succeed(Greeting, 'bye') })
    expect(differ.mismatches).toHaveLength(1)
    expect(differ.container.innerHTML).toBe(differ.fresh.innerHTML)
  })

  it('a Boundary fallback rendered on the server is replaced by the content that succeeds on the client', async () => {
    const tree = (fail: boolean) => () =>
      jsx(Boundary, { tag: 'Boom', fallback: () => Effect.succeed(el('em', {}, 'caught')), children: fail ? Effect.fail(new Boom()) : Effect.succeed(el('p', {}, 'ok')) })
    const { container, fresh, mismatches } = await mismatchCase({ server: tree(true), client: tree(false) })
    expect(mismatches).toHaveLength(1)
    expect(container.innerHTML).toBe(fresh.innerHTML)
    expect(container.textContent).toBe('ok')
  })

  it('browser-mutated DOM: a replaced node and an injected extra node each report once', async () => {
    const app = () => jsx('ul', { children: [jsx('li', { children: 'a' }), jsx('li', { children: 'b' })] })
    const { container, fresh, mismatches } = await mismatchCase({
      server: app,
      client: app,
      mutate: (c) => {
        c.querySelector('li')!.replaceWith(document.createElement('span'))
        c.querySelector('ul')!.append(document.createElement('ins'), document.createElement('ins'))
      },
    })
    expect(mismatches.map((m) => [m.expected, m.found])).toEqual([
      ['<li>', 'SPAN'],
      ['nothing', 'INS'],
    ])
    expect(container.innerHTML).toBe(fresh.innerHTML)
  })

  it('a resume manifest script is ignored without a report', async () => {
    const app = () => jsx('p', { children: 'x' })
    const { container, errors } = await mismatchCase({ server: app, client: app, html: (h) => `${h}<script type="application/json" data-sleek-manifest>{}</script>` })
    expect(errors).toEqual([])
    expect(container.innerHTML).toBe('<p>x</p>')
  })

  // Documented non-goal: the parser inserts <tbody>, so the walk sees a mismatch and recovers.
  it('parser-normalised DOM is not adopted: it reports and recovers to a client render', async () => {
    const app = () => jsx('table', { children: jsx('tr', { children: jsx('td', { children: 'c' }) }) })
    const { container, fresh, mismatches } = await mismatchCase({ server: app, client: app })
    expect(mismatches.length).toBeGreaterThan(0)
    expect(container.innerHTML).toBe(fresh.innerHTML)
  })

  it('a renderer defect during the walk falls back to a full client render of the container', async () => {
    const container = document.createElement('div')
    container.innerHTML = await renderToString(jsx('div', { children: [jsx('b', { children: 'ok' }), jsx('i', { children: 'x' })] }), { layer: Layer.empty })
    const server = [...container.querySelectorAll('b')]
    const onError = vi.fn()
    // An invalid attribute name makes `checkAttr` throw while adopting the client tree.
    const client = () => Effect.succeed(el('div', {}, el('b', {}, 'ok'), el('i', { 'bad name': 'v' }, 'x')))
    await act(async () => void handles.push(await hydrateMount(client(), { layer: Layer.empty, container, onError })))
    expect(onError).toHaveBeenCalled()
    expect(container.querySelector('b')).not.toBe(server[0])
    const fresh = document.createElement('div')
    await act(async () => void handles.push(await mount(client(), { layer: Layer.empty, container: fresh, onError: () => {} })))
    expect(container.innerHTML).toBe(fresh.innerHTML)
  })
})
