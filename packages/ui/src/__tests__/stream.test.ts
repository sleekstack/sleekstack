// @vitest-environment jsdom
import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { el, Pending, renderToStream, renderToString } from '../index'
import { jsx as rawJsx } from '../jsx-runtime'

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
