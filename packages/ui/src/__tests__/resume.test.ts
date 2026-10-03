// @vitest-environment jsdom
import { Atom } from '@sleekstack/core'
import { Context, Effect, Layer, Schema } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bind, defineHandler, el, fragment, ManifestDecodeFailed, ManifestInvalid, on, renderToString, resume, type Resumed, Store,
} from '../index'

class Step extends Context.Tag('Step')<Step, number>() {}
const count = Atom.make(0)
const inc = defineHandler('inc', () => Effect.flatMap(Step, (n) => Effect.flatMap(Store, (s) => Effect.sync(() => s.update(count, (c) => c + n)))), { preventDefault: true })
const seen: Array<unknown> = []
const log = defineHandler('log', (e) => Effect.sync(() => void seen.push(e)), { stopPropagation: true })
const boom = defineHandler('boom', () => Effect.fail('bad'))

const spy = vi.fn()
const Counter = () =>
  Effect.sync(() => {
    spy()
    return fragment(
      on(el('button', { id: 'b' }, 'add'), { click: inc }),
      el('p', {}, bind(count, 'n')),
      bind(count, 'n'),
      on(el('div', { id: 'outer' }, on(el('input', { id: 'in', value: 'x' }), { click: log }), el('span', { id: 'sp' })), { click: log }),
      on(el('i', { id: 'boom' }), { click: boom }),
    )
  })

const handles: Array<Resumed> = []
afterEach(async () => {
  for (const h of handles.splice(0)) await h.dispose()
  seen.length = 0
  document.body.replaceChildren() // jsdom's id lookup misses when ids repeat across containers
})

const setup = async (html?: string) => {
  const container = document.createElement('div')
  container.innerHTML = html ?? (await renderToString(Counter(), { layer: Layer.empty }))
  document.body.append(container)
  return container
}
const loaders = (extra: Record<string, () => Promise<any>> = {}) => ({
  inc: vi.fn(async () => ({ default: inc })),
  log: vi.fn(async () => ({ default: log })),
  boom: async () => ({ default: boom }),
  ...extra,
})
const start = async (container: Element, handlers: Record<string, () => Promise<any>> = loaders(), onError = vi.fn()) => {
  const h = await resume({ container, layer: Layer.succeed(Step, 1), handlers, atoms: { n: count }, onError })
  handles.push(h)
  return h
}
const click = (c: Element, sel: string) => {
  const e = new MouseEvent('click', { bubbles: true, cancelable: true })
  c.querySelector(sel)!.dispatchEvent(e)
  return e
}
const defer = () => {
  let resolve!: () => void
  const promise = new Promise<void>((r) => (resolve = r))
  return { promise, resolve }
}
const flush = () => new Promise((r) => setTimeout(r, 0))
const texts = (c: Element) => [...c.querySelectorAll('[data-sleek-bind]')].map((n) => n.textContent)

describe('resume', () => {
  it('resumes with zero component calls; a lazy handler writes an atom and every bound node updates', async () => {
    const c = await setup()
    spy.mockClear()
    const handlers = loaders()
    await start(c, handlers)
    expect(spy).not.toHaveBeenCalled()
    expect(handlers.inc).not.toHaveBeenCalled()
    for (let i = 0; i < 3; i++) click(c, '#b')
    await flush()
    expect(handlers.inc).toHaveBeenCalledTimes(1)
    expect(texts(c)).toEqual(['3', '3'])
    expect(spy).not.toHaveBeenCalled()
  })

  it('runs mixed ids in event order while loads overlap', async () => {
    const c = await setup()
    const order: Array<string> = []
    const gate = defer()
    const a = defineHandler('a', () => Effect.sync(() => void order.push('a')))
    const b = defineHandler('b', () => Effect.sync(() => void order.push('b')))
    c.innerHTML = '<i id="a" data-sleek-on-click="a"></i><i id="b" data-sleek-on-click="b"></i><script type="application/json" data-sleek-manifest>{"v":1,"events":["click"],"atoms":{}}</script>'
    await start(c, { a: async () => (await gate.promise, { default: a }), b: async () => ({ default: b }) })
    click(c, '#a'), click(c, '#b'), click(c, '#a')
    await flush()
    expect(order).toEqual([])
    gate.resolve()
    await flush()
    expect(order).toEqual(['a', 'b', 'a'])
  })

  it('applies static flags before load, runs only the closest handler, snapshots form controls only', async () => {
    const c = await setup()
    const outer = vi.fn()
    document.body.addEventListener('click', outer)
    await start(c)
    expect(click(c, '#b').defaultPrevented).toBe(true)
    click(c, '#in')
    click(c, '#sp')
    expect(outer).toHaveBeenCalledTimes(1) // only #b's click reached the body; log stops propagation synchronously
    document.body.removeEventListener('click', outer)
    await flush()
    expect(seen).toEqual([
      { type: 'click', value: 'x', checked: false },
      { type: 'click' },
    ])
  })

  it.each([
    ['missing', '<p></p>', ManifestInvalid],
    ['several', '<script type="application/json" data-sleek-manifest>{"v":1,"events":[],"atoms":{}}</script>'.repeat(2), ManifestInvalid],
    ['malformed', '<script type="application/json" data-sleek-manifest>{nope</script>', ManifestInvalid],
    ['undecodable', '<script type="application/json" data-sleek-manifest>{"v":1,"events":[],"atoms":{"n":"x"}}</script>', ManifestDecodeFailed],
  ])('rejects a %s manifest and leaves the container untouched', async (_, html, error) => {
    const c = await setup(html)
    const before = c.innerHTML
    const n = Atom.serializable(Atom.make(0), { key: 'n', schema: Schema.Number })
    const p = resume({ container: c, layer: Layer.empty, handlers: {}, atoms: { n } })
    await expect(p).rejects.toBeInstanceOf(error)
    if (error === ManifestDecodeFailed) await expect(p).rejects.toMatchObject({ key: 'n' })
    expect(c.innerHTML).toBe(before)
  })

  it('seeds a read-only serializable atom without calling write; a plain read-only atom resumes unseeded', async () => {
    const big = Atom.serializable(Atom.make(() => 1n), { key: 'big', schema: Schema.BigInt })
    const html = '<sleek-bind data-sleek-bind="b">7</sleek-bind><script type="application/json" data-sleek-manifest>{"v":1,"events":[],"atoms":{"b":"7"}}</script>'
    const c = await setup(html)
    const h = await resume({ container: c, layer: Layer.empty, handlers: {}, atoms: { b: big } })
    handles.push(h)
    handles.push(await resume({ container: await setup(html), layer: Layer.empty, handlers: {}, atoms: { b: Atom.make(() => 1) } }))
  })

  it('rejects with the original layer error and can be retried', async () => {
    const c = await setup()
    const err = new Error('layer')
    await expect(resume({ container: c, layer: Layer.fail(err), handlers: {}, atoms: { n: count } })).rejects.toBe(err)
    await start(c)
  })

  it('reports runtime errors via onError and keeps working; rejected imports retry', async () => {
    const c = await setup()
    let fail = true
    const onError = vi.fn()
    const flaky = vi.fn(async () => {
      if (fail) throw new Error('chunk')
      return { default: inc }
    })
    c.querySelector('#sp')!.setAttribute('data-sleek-on-click', 'nope')
    c.querySelector('#outer')!.setAttribute('data-sleek-on-click', 'mismatch')
    await start(c, loaders({ inc: flaky, mismatch: async () => ({ default: log }) }), onError)
    click(c, '#b'), click(c, '#sp'), click(c, '#outer'), click(c, '#boom')
    await flush()
    const errs = onError.mock.calls.map(([cause]) => JSON.stringify(cause))
    expect(errs).toHaveLength(4)
    expect(String(onError.mock.calls[0]![0])).toContain('chunk')
    expect(errs[1]).toContain('UnknownHandler')
    expect(errs[2]).toContain('HandlerIdMismatch')
    expect(errs[3]).toContain('bad')
    expect(texts(c)).toEqual(['0', '0'])
    fail = false
    click(c, '#b')
    await flush()
    expect(flaky).toHaveBeenCalledTimes(2)
    expect(texts(c)).toEqual(['1', '1'])
  })

  it('second resume returns the first handle; late runs after dispose are dropped; resume after dispose works', async () => {
    const c = await setup()
    const gate = defer()
    const h1 = await start(c, loaders({ inc: async () => (await gate.promise, { default: inc }) }))
    expect(await resume({ container: c, layer: Layer.empty, handlers: {}, atoms: {} })).toBe(h1)
    click(c, '#b')
    await h1.dispose()
    gate.resolve()
    await flush()
    expect(texts(c)).toEqual(['0', '0'])
    const h2 = await start(c)
    expect(h2).not.toBe(h1)
    click(c, '#b')
    await flush()
    expect(texts(c)).toEqual(['1', '1'])
  })

  it('dispose interrupts a running handler; a sync throw does not stall the queue', async () => {
    const c = await setup()
    let wrote = false
    const slow = defineHandler('inc', () => Effect.zipRight(Effect.sleep(20), Effect.sync(() => void (wrote = true))))
    const thrower = defineHandler('boom', () => {
      throw new Error('sync')
    })
    const onError = vi.fn()
    const h = await start(c, loaders({ inc: async () => ({ default: slow }), boom: async () => ({ default: thrower }) }), onError)
    click(c, '#boom'), click(c, '#b')
    await flush()
    expect(String(onError.mock.calls[0]![0])).toContain('sync')
    await h.dispose()
    await new Promise((r) => setTimeout(r, 40))
    expect(wrote).toBe(false)
  })

  it('dispose interrupts a forked fiber and removes listeners', async () => {
    const c = await setup()
    const interrupted = defer()
    const fork = defineHandler('inc', () => Effect.forkScoped(Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(() => interrupted.resolve())))))
    const load = vi.fn(async () => ({ default: fork }))
    const h = await start(c, loaders({ inc: load }))
    click(c, '#b')
    await flush()
    await h.dispose()
    await interrupted.promise
    click(c, '#b')
    await flush()
    expect(load).toHaveBeenCalledTimes(1)
  })
})
