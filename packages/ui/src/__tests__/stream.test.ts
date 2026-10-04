// @vitest-environment jsdom
import { QueryClientLive } from '@sleekstack/query'
import type { QueryClient } from '@tanstack/query-core'
import { type Cause, Data, Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { Boundary, el, fragment, Pending, renderToStream, renderToString } from '../index'
import { useQuery, useQueryClient } from '../query'
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
  const Slow = () => Effect.map(Effect.promise(() => wait ?? Promise.resolve()), () => el('b', {}, 'done'))
  return jsx('div', { children: [jsx('p', { children: 'head' }), jsx(Pending, { fallback: jsx('i', { children: 'wait' }), children: jsx(Slow, {}) })] })
}

// Applies streamed HTML the way a browser would: parse, then run the inline scripts in order.
const apply = (html: string): string => {
  document.body.innerHTML = html
  for (const s of [...document.body.querySelectorAll('script')]) {
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
    expect(apply(first + rest)).toBe(await renderToString(tree(), { layer }))
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
  const slow = (wait: Promise<void> | undefined, tag: string, child: any = tag) => () =>
    Effect.map(Effect.promise(() => wait ?? Promise.resolve()), () => jsx(tag, { children: child }))
  const fallback = (t: string) => jsx('i', { children: t })

  it('streams boundaries in completion order; the swapped DOM equals renderToString', async () => {
    const a = gate()
    const b = gate()
    const app = (pa?: Promise<void>, pb?: Promise<void>) =>
      jsx('div', { children: [
        jsx(Pending, { fallback: fallback('A'), children: jsx(slow(pa, 'a'), {}) }),
        jsx(Pending, { fallback: fallback('B'), children: jsx(slow(pb, 'b'), {}) }),
      ] })
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
  ] as const)('a nested boundary whose content resolves %s its parent streams its chunk after the parent chunk', async (_, innerFirst) => {
    const outer = gate()
    const inner = gate()
    const app = (po?: Promise<void>, pi?: Promise<void>) => {
      const Inner = slow(pi, 'b')
      const Outer = () => Effect.flatMap(Effect.promise(() => po ?? Promise.resolve()), () =>
        jsx('section', { children: jsx(Pending, { fallback: fallback('in'), children: jsx(Inner, {}) }) }))
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
  })

  it('boundary content starting with text after a text sibling keeps the text separator', async () => {
    const app = jsx('div', { children: ['x', jsx(Pending, { fallback: fallback('w'), children: jsx(slow(undefined, 'span', 'y'), {}) })] })
    const textFirst = jsx('div', { children: ['x', jsx(Pending, { fallback: 'w', children: jsx(() => Effect.map(Effect.promise(() => Promise.resolve()), () => fragment('y')), {}) }), 'z'] })
    expect(normalize(apply(await read(renderToStream(app, { layer }))))).toBe(normalize(await renderToString(app, { layer })))
    expect(normalize(apply(await read(renderToStream(textFirst, { layer }))))).toBe(normalize(await renderToString(textFirst, { layer })))
  })

  it('puts the nonce on every inline script', async () => {
    const html = await read(renderToStream(tree(), { layer, nonce: 'n0"' }))
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0])
    expect(scripts.length).toBeGreaterThanOrEqual(2)
    for (const s of scripts) expect(s).toContain('nonce="n0&quot;"')
  })
})

class Boom extends Data.TaggedError('Boom')<{}> {}
const failing = (g: { promise: Promise<void> }) => () => Effect.flatMap(Effect.promise(() => g.promise), () => Effect.fail(new Boom()))
const drain = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
  let out = ''
  for (let r = await reader.read(); !r.done; r = await reader.read()) out += decoder.decode(r.value)
  return out
}

describe('renderToStream errors and cancel (R2, R4)', () => {
  it('a boundary failing after flush streams the nearest Boundary fallback', async () => {
    const g = gate()
    const app = jsx(Boundary, { tag: 'Boom', fallback: () => jsx('p', { children: 'caught' }), children: jsx(Pending, { fallback: 'wait', children: jsx(failing(g), {}) }) })
    const errors: Array<Cause.Cause<unknown>> = []
    const reader = renderToStream(app, { layer, onError: (c) => errors.push(c) }).getReader()
    const first = decoder.decode((await reader.read()).value)
    expect(first).toContain('<!--sleek-p:sleek-0-->wait<!--/sleek-p-->')
    g.open()
    const rest = await drain(reader)
    expect(rest).toContain('<template data-sleek-b="sleek-0"><p>caught</p></template>')
    expect(apply(first + rest)).toBe('<p>caught</p>')
    expect(errors).toEqual([])
  })

  it('an unhandled failure after flush keeps the Pending fallback and reports once to onError', async () => {
    const g = gate()
    const errors: Array<Cause.Cause<unknown>> = []
    const reader = renderToStream(jsx(Pending, { fallback: 'wait', children: jsx(failing(g), {}) }), { layer, onError: (c) => errors.push(c) }).getReader()
    const first = decoder.decode((await reader.read()).value)
    g.open()
    const rest = await drain(reader)
    expect(rest).not.toContain('<template')
    expect(normalize(apply(first + rest))).toContain('wait')
    expect(errors).toHaveLength(1)
  })

  it('cancel interrupts pending content, closes its scope (observer retain count 0) and drops late errors', async () => {
    const g = gate()
    let client: QueryClient | undefined
    const observers = () => client?.getQueryCache().find({ queryKey: ['s'] })?.getObserversCount() ?? 0
    const Q = () =>
      Effect.flatMap(useQueryClient(), (c) => ((client = c), Effect.flatMap(useQuery({ queryKey: ['s'], queryFn: async () => 'q', retry: false }), () => Effect.flatMap(Effect.promise(() => g.promise), () => Effect.fail(new Boom())))))
    const errors: Array<Cause.Cause<unknown>> = []
    const reader = renderToStream(jsx(Pending, { fallback: 'wait', children: jsx(Q, {}) }), { layer: QueryClientLive(), onError: (c) => errors.push(c) }).getReader()
    await reader.read()
    expect(observers()).toBe(1)
    await reader.cancel()
    expect(observers()).toBe(0)
    g.open()
    await new Promise((r) => setTimeout(r, 10))
    expect(errors).toEqual([])
  })
})
