// @vitest-environment jsdom
import { Pending, renderToStream } from '@sleekstack/ui'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { Effect, Layer } from 'effect'
import { expect, it } from 'vitest'

const decoder = new TextDecoder()

// A page section whose Pending content resolves after `wait`.
const section = (name: string, wait: Promise<void>) => {
  const Slow = () =>
    Effect.flatMap(
      Effect.promise(() => wait),
      () => jsx('b', { children: `${name} done` }),
    )
  return jsx('section', {
    children: jsx(Pending as any, { fallback: jsx('i', { children: `${name} wait` }), children: jsx(Slow as any, {}) }),
  })
}

const shellAndRest = async (stream: ReadableStream<Uint8Array>) => {
  const reader = stream.getReader()
  const shell = decoder.decode((await reader.read()).value)
  return {
    shell,
    rest: async () => {
      let out = ''
      for (let r = await reader.read(); !r.done; r = await reader.read()) out += decoder.decode(r.value)
      return out
    },
  }
}

it('two streams on one page with distinct idPrefix do not collide, even though the later shell replaces __sleekSwap (R5)', async () => {
  let open!: () => void
  const wait = new Promise<void>((r) => (open = r))
  const a = await shellAndRest(renderToStream(section('A', wait), { layer: Layer.empty, idPrefix: 'a-', nonce: 'n1' }))
  const b = await shellAndRest(renderToStream(section('B', wait), { layer: Layer.empty, idPrefix: 'b-', nonce: 'n1' }))
  expect(a.shell).toContain('<!--sleek-p:a-0-->')
  expect(b.shell).toContain('<!--sleek-p:b-0-->')
  open()
  // Interleaved as one page: both shells, then both chunk streams.
  document.body.innerHTML = a.shell + b.shell + (await a.rest()) + (await b.rest())
  const scripts = [...document.body.querySelectorAll('script')]
  expect(scripts.every((s) => s.getAttribute('nonce') === 'n1')).toBe(true)
  for (const s of scripts.filter((s) => !s.type)) {
    s.remove()
    new Function(s.textContent!)()
  }
  const [sa, sb] = document.body.querySelectorAll('section')
  expect(sa!.innerHTML).toBe('<b>A done</b>')
  expect(sb!.innerHTML).toBe('<b>B done</b>')
  expect(document.body.querySelectorAll('template')).toHaveLength(0)
})
