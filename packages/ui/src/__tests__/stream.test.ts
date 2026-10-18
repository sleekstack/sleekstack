// @vitest-environment jsdom
import { Atom, makeAtomStore } from '@sleekstack/core'
import { type Cause, Data, Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { Boundary, el, fragment, Head, Pending, renderToStream, renderToString } from '../index'
import { jsx as rawJsx } from '../jsx-runtime'
import { normalize } from './helpers/normalize'

const jsx = (type: any, props: any, key?: string) => rawJsx(type, props, key)
const layer = Layer.empty
const decoder = new TextDecoder()

const gate = () => {
  let open!: () => void
  const promise = new Promise<void>((r) => (open = r))
  return { promise, open }
}

// A Pending whose content waits for `wait` (resolved immediately when absent).
const tree = (wait?: Promise<void>) => {
  const Slow = () =>
    Effect.map(
      Effect.promise(() => wait ?? Promise.resolve()),
      () => el('b', {}, 'done'),
    )
  return jsx('div', {
    children: [
      jsx('p', { children: 'head' }),
      jsx(Pending, { fallback: jsx('i', { children: 'wait' }), children: jsx(Slow, {}) }),
    ],
  })
}

// Applies streamed HTML the way a browser would: parse, then run the inline scripts in order.
const apply = (html: string): string => {
  document.body.innerHTML = html
  for (const s of [...document.body.querySelectorAll('script:not([type])')]) {
    s.remove()
    new Function(s.textContent!)()
  }
  return document.body.innerHTML
}

describe('renderToStream (R1)', () => {
  it('flushes the shell with the fallback before any boundary resolves; the swapped DOM equals renderToString', async () => {
    const g = gate()
    const reader = renderToStream(tree(g.promise), { layer }).getReader()
    const first = decoder.decode((await reader.read()).value)
    expect(first).toContain('<p>head</p>')
    expect(first).toContain('<!--sleek-p:sleek-0--><i>wait</i><!--/sleek-p-->')
    expect(first).not.toContain('done')
    g.open()
    let rest = ''
    for (let r = await reader.read(); !r.done; r = await reader.read()) rest += decoder.decode(r.value)
    expect(rest).toContain('<template data-sleek-b="sleek-0"><b>done</b></template>')
    expect(normalize(apply(first + rest))).toBe(await renderToString(tree(), { layer }))
  })

  it('a defect before flush rejects the stream with the original error', async () => {
    const defect = new Error('defect')
    await expect(new Response(renderToStream(Effect.die(defect), { layer })).text()).rejects.toBe(defect)
  })

  it('a zero-pending tree streams exactly the renderToString output and closes', async () => {
    const app = jsx('div', { children: jsx('p', { children: 'hi' }) })
    expect(await new Response(renderToStream(app, { layer })).text()).toBe(await renderToString(app, { layer }))
  })

  it('rejects an invalid idPrefix', () => {
    expect(() => renderToStream(tree(), { layer, idPrefix: 'a"b' })).toThrow(TypeError)
  })
})

const read = async (stream: ReadableStream<Uint8Array>, onChunk?: (chunk: string) => void): Promise<string> => {
  const reader = stream.getReader()
  let all = ''
  for (let r = await reader.read(); !r.done; r = await reader.read()) {
    const chunk = decoder.decode(r.value)
    onChunk?.(chunk)
    all += chunk
  }
  return all
}

describe('renderToStream boundaries (R2, R5)', () => {
  const slow =
    (wait: Promise<void> | undefined, tag: string, child: any = tag) =>
    () =>
      Effect.map(
        Effect.promise(() => wait ?? Promise.resolve()),
        () => jsx(tag, { children: child }),
      )
  const fallback = (t: string) => jsx('i', { children: t })

  it('streams boundaries in completion order; the swapped DOM equals renderToString', async () => {
    const a = gate()
    const b = gate()
    const app = (pa?: Promise<void>, pb?: Promise<void>) =>
      jsx('div', {
        children: [
          jsx(Pending, { fallback: fallback('A'), children: jsx(slow(pa, 'a'), {}) }),
          jsx(Pending, { fallback: fallback('B'), children: jsx(slow(pb, 'b'), {}) }),
        ],
      })
    const order: Array<string> = []
    const done = read(renderToStream(app(a.promise, b.promise), { layer }), (chunk) => {
      for (const m of chunk.matchAll(/<template data-sleek-b="([^"]+)"/g)) order.push(m[1]!)
    })
    await new Promise((r) => setTimeout(r, 20))
    b.open()
    await new Promise((r) => setTimeout(r, 20))
    a.open()
    const html = await done
    expect(order).toEqual(['sleek-1', 'sleek-0'])
    expect(normalize(apply(html))).toBe(normalize(await renderToString(app(), { layer })))
  })

  it.each([
    ['after', false],
    ['before', true],
  ] as const)(
    'a nested boundary whose content resolves %s its parent streams its chunk after the parent chunk',
    async (_, innerFirst) => {
      const outer = gate()
      const inner = gate()
      const app = (po?: Promise<void>, pi?: Promise<void>) => {
        const Inner = slow(pi, 'b')
        const Outer = () =>
          Effect.flatMap(
            Effect.promise(() => po ?? Promise.resolve()),
            () => jsx('section', { children: jsx(Pending, { fallback: fallback('in'), children: jsx(Inner, {}) }) }),
          )
        return jsx('div', { children: jsx(Pending, { fallback: fallback('out'), children: jsx(Outer, {}) }) })
      }
      if (innerFirst) inner.open()
      const order: Array<string> = []
      const done = read(renderToStream(app(outer.promise, inner.promise), { layer }), (chunk) => {
        for (const m of chunk.matchAll(/<template data-sleek-b="([^"]+)"/g)) order.push(m[1]!)
      })
      await new Promise((r) => setTimeout(r, 20))
      outer.open()
      await new Promise((r) => setTimeout(r, 20))
      inner.open()
      const html = await done
      expect(order).toEqual(['sleek-0', 'sleek-1'])
      expect(normalize(apply(html))).toBe(normalize(await renderToString(app(), { layer })))
    },
  )

  it('boundary content starting with text after a text sibling keeps the text separator', async () => {
    const app = jsx('div', {
      children: ['x', jsx(Pending, { fallback: fallback('w'), children: jsx(slow(undefined, 'span', 'y'), {}) })],
    })
    const textFirst = jsx('div', {
      children: [
        'x',
        jsx(Pending, {
          fallback: 'w',
          children: jsx(
            () =>
              Effect.map(
                Effect.promise(() => Promise.resolve()),
                () => fragment('y'),
              ),
            {},
          ),
        }),
        'z',
      ],
    })
    expect(normalize(apply(await read(renderToStream(app, { layer }))))).toBe(
      normalize(await renderToString(app, { layer })),
    )
    expect(normalize(apply(await read(renderToStream(textFirst, { layer }))))).toBe(
      normalize(await renderToString(textFirst, { layer })),
    )
  })

  it('puts the nonce on every inline script', async () => {
    const html = await read(renderToStream(tree(), { layer, nonce: 'n0"' }))
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0])
    expect(scripts.length).toBeGreaterThanOrEqual(2)
    for (const s of scripts) expect(s).toContain('nonce="n0&quot;"')
  })
})

class Boom extends Data.TaggedError('Boom')<{}> {}
const failing = (g: { promise: Promise<void> }) => () =>
  Effect.flatMap(
    Effect.promise(() => g.promise),
    () => Effect.fail(new Boom()),
  )
const drain = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
  let out = ''
  for (let r = await reader.read(); !r.done; r = await reader.read()) out += decoder.decode(r.value)
  return out
}

describe('renderToStream errors and cancel (R2, R4)', () => {
  it('a boundary failing after flush streams the nearest Boundary fallback', async () => {
    const g = gate()
    const app = jsx(Boundary, {
      tag: 'Boom',
      fallback: () => jsx('p', { children: 'caught' }),
      children: jsx(Pending, { fallback: 'wait', children: jsx(failing(g), {}) }),
    })
    const errors: Array<Cause.Cause<unknown>> = []
    const reader = renderToStream(app, { layer, onError: (c) => errors.push(c) }).getReader()
    const first = decoder.decode((await reader.read()).value)
    expect(first).toContain('<!--sleek-p:sleek-0-->wait<!--/sleek-p-->')
    g.open()
    const rest = await drain(reader)
    expect(rest).toContain('<template data-sleek-b="sleek-0"><p>caught</p></template>')
    // `Boundary` is an instance (ADR 0035): it reads its reset epoch, so it carries an instance host.
    expect(normalize(apply(first + rest))).toBe(
      '<sleek-reactive style="display: contents;"><p>caught</p></sleek-reactive>',
    )
    expect(errors).toEqual([])
  })

  it('an unhandled failure after flush keeps the Pending fallback and reports once to onError', async () => {
    const g = gate()
    const errors: Array<Cause.Cause<unknown>> = []
    const reader = renderToStream(jsx(Pending, { fallback: 'wait', children: jsx(failing(g), {}) }), {
      layer,
      onError: (c) => errors.push(c),
    }).getReader()
    const first = decoder.decode((await reader.read()).value)
    g.open()
    const rest = await drain(reader)
    expect(rest).not.toContain('<template')
    expect(normalize(apply(first + rest))).toContain('wait')
    expect(errors).toHaveLength(1)
  })
})

describe('renderToStream late boundaries (R3)', () => {
  // Appends streamed HTML the way a parser does: nodes in order, each inline script run as it is reached.
  const feed = (container: Element, html: string) => {
    const t = document.createElement('div')
    t.innerHTML = html
    for (const n of [...t.childNodes]) {
      container.append(n)
      if (n.nodeName === 'SCRIPT' && !(n as Element).hasAttribute('type')) (n.remove(), new Function(n.textContent!)())
    }
  }
  const settle = async (act: (f: () => Promise<void>) => Promise<void>) =>
    act(() => new Promise((r) => setTimeout(r, 10)))

  it('a chunk that never arrives leaves the fallback and reports BoundaryChunkMissing', async () => {
    const { act } = await import('react')
    const { BoundaryChunkMissing, hydrateMount } = await import('../index')
    delete (globalThis as { __sleekGone?: unknown }).__sleekGone
    const g = gate()
    const app = () =>
      jsx('div', {
        children: jsx(Pending, { fallback: jsx('i', { children: 'wait' }), children: jsx(failing(g), {}) }),
      })
    const reader = renderToStream(app(), { layer, onError: () => {} }).getReader()
    const shell = decoder.decode((await reader.read()).value)
    const container = document.createElement('div')
    document.body.replaceChildren(container)
    feed(container, shell)
    const errors: Array<Cause.Cause<unknown>> = []
    let h: any
    await act(async () => void (h = await hydrateMount(app(), { layer, container, onError: (c) => errors.push(c) })))
    g.open()
    const rest = await drain(reader)
    expect(rest).toContain('__sleekEnd(["sleek-0"])')
    await act(async () => feed(container, rest))
    expect(errors.map((c) => (c as any).error)).toEqual([new BoundaryChunkMissing({ id: 'sleek-0' })])
    expect(container.querySelector('i')!.textContent).toBe('wait')
    await act(async () => void (await h.dispose()))
  })

  // Hydrates mid-stream an app whose late title replaces a fallback title; `show` false drops the boundary on the client.
  const midStream = async () => {
    const { act } = await import('react')
    const { hydrateMount, useAtomValue } = await import('../index')
    delete (globalThis as { __sleekGone?: unknown }).__sleekGone
    const g = gate()
    const show = Atom.make(true)
    const title = (text: string) => jsx(Head, { children: jsx('title', { children: text }) })
    const Late = () =>
      Effect.flatMap(
        Effect.promise(() => g.promise),
        () => title('done'),
      )
    // A reactive instance, so releasing the fallback runs its Head's cleanup on the spot.
    const Loading = () => Effect.flatMap(useAtomValue(show), () => title('loading'))
    const App = () =>
      Effect.flatMap(useAtomValue(show), (on) =>
        jsx('div', {
          children: on ? jsx(Pending, { fallback: jsx(Loading, {}), children: jsx(Late, {}) }) : title('elsewhere'),
        }),
      )
    let shellHead = ''
    const reader = renderToStream(jsx(App, {}), { layer, onHead: (h) => (shellHead = h) }).getReader()
    const shell = decoder.decode((await reader.read()).value)
    document.head.innerHTML = shellHead
    const server = document.head.firstElementChild
    const container = document.createElement('div')
    document.body.replaceChildren(container)
    feed(container, shell)
    const store = makeAtomStore()
    const h = await act(async () => hydrateMount(jsx(App, {}), { layer, container, store }))
    const land = async () => {
      g.open()
      const rest = await drain(reader)
      expect(rest).toContain('__sleekHead')
      await act(async () => feed(container, rest))
      await settle(act)
    }
    return { act, h, server, land, drop: () => act(async () => store.set(show, false)) }
  }

  it('hydrating mid-stream, the content takes over the adopted tag the late patch also targets (R4)', async () => {
    const { act, h, server, land } = await midStream()
    await land()
    expect(document.head.innerHTML).toBe('<title>done</title>')
    expect(document.head.firstElementChild).toBe(server)
    await act(async () => void (await h.dispose()))
    expect(document.head.innerHTML).toBe('')
  })

  it('a late head patch for a boundary the hydrated client dropped changes nothing (R4)', async () => {
    const { act, h, land, drop } = await midStream()
    await drop()
    expect(document.head.innerHTML).toBe('<title>elsewhere</title>')
    await land()
    expect(document.head.innerHTML).toBe('<title>elsewhere</title>')
    await act(async () => void (await h.dispose()))
  })
})

describe('renderToStream Head (R1, R3)', () => {
  const tags = (title: string, description: string) => [
    jsx('title', { children: title }),
    jsx('meta', { name: 'description', content: description }),
  ]

  it('passes the shell head to onHead once; it equals the renderToString head for the same tree', async () => {
    const Inner = () => jsx(Head, { children: tags('inner', 'in') })
    const app = jsx('div', {
      children: [
        jsx('p', { children: jsx(Inner, {}) }),
        jsx(Head, { children: [...tags('outer', 'out'), jsx('link', { rel: 'icon', href: '/i.png' })] }),
      ],
    })
    const streamed: Array<string> = []
    await read(renderToStream(app, { layer, onHead: (h) => streamed.push(h) }))
    let expected: string | undefined
    await renderToString(app, { layer, onHead: (h) => (expected = h) })
    expect(streamed).toEqual([expected])
  })

  it('after flush, title and keyed meta follow the boundary; link and unkeyed tags stay as the shell had them', async () => {
    const g = gate()
    const Content = () =>
      Effect.flatMap(
        Effect.promise(() => g.promise),
        () =>
          jsx(Head, {
            children: [
              ...tags('done', 'late'),
              jsx('link', { rel: 'canonical', href: '/late' }),
              jsx('meta', { charset: 'utf-8' }),
            ],
          }),
      )
    const Fallback = () =>
      jsx(Head, { children: [jsx('title', { children: 'loading' }), jsx('meta', { name: 'robots', content: 'none' })] })
    const app = jsx('div', {
      children: [
        jsx(Head, { children: [...tags('shell', 'early'), jsx('link', { rel: 'canonical', href: '/shell' })] }),
        jsx(Pending, { fallback: jsx(Fallback, {}), children: jsx(Content, {}) }),
      ],
    })
    let shellHead = ''
    const reader = renderToStream(app, { layer, nonce: 'n', onHead: (h) => (shellHead = h) }).getReader()
    const first = decoder.decode((await reader.read()).value)
    expect(shellHead).toBe(
      '<title>loading</title><meta name="description" content="early"><link rel="canonical" href="/shell"><meta name="robots" content="none">',
    )
    g.open()
    const rest = await drain(reader)
    expect(rest).not.toContain('/late')
    expect(rest).not.toContain('charset')
    document.head.innerHTML = shellHead
    apply(first + rest)
    expect(document.head.innerHTML).toBe(
      '<title>done</title><meta name="description" content="late"><link rel="canonical" href="/shell">',
    )
  })

  it.each([
    ['inner', 'outer'],
    ['outer', 'inner'],
  ] as const)(
    'a boundary nested in a fallback loses its head when the outer content replaces it (%s resolves first)',
    async (...order) => {
      const gates = { inner: gate(), outer: gate() }
      const title = (text: string) => jsx(Head, { children: jsx('title', { children: text }) })
      const after = (g: { promise: Promise<void> }, node: unknown) => () =>
        Effect.flatMap(
          Effect.promise(() => g.promise),
          () => node as Effect.Effect<any>,
        )
      const Inner = after(gates.inner, title('inner'))
      const Outer = after(gates.outer, Effect.succeed(el('b', {}, 'outer')))
      const fallback = jsx('div', {
        children: [
          title('outer loading'),
          jsx(Pending, { fallback: title('inner loading'), children: jsx(Inner, {}) }),
        ],
      })
      const app = jsx('div', {
        children: [title('shell'), jsx(Pending, { fallback, children: jsx(Outer, {}) })],
      })
      let shellHead = ''
      const reader = renderToStream(app, { layer, onHead: (h) => (shellHead = h) }).getReader()
      let html = decoder.decode((await reader.read()).value)
      expect(shellHead).toBe('<title>inner loading</title>')
      document.head.innerHTML = shellHead
      for (const k of order) {
        gates[k].open()
        html += decoder.decode((await reader.read()).value)
      }
      html += await drain(reader)
      apply(html)
      expect(document.head.innerHTML).toBe('<title>shell</title>')
    },
  )
})
