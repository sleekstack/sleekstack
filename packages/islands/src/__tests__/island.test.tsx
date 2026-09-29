import { act, StrictMode } from 'react'
import { prerender } from 'react-dom/static'
import { hydrateRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineIslands, IslandNotFound } from '../index'
import { arm } from '../triggers'

let renders = 0
const Counter = ({ start }: { start: number }) => {
  renders++
  return <button type="button">{`count ${start}`}</button>
}
const loader = vi.fn(async () => ({ default: Counter }))
const Island = defineIslands({ counter: loader })

const serverHtml = async (ui: React.ReactNode) => {
  const g = globalThis as { window?: unknown }
  const w = g.window
  delete g.window // server branch
  try {
    const { prelude } = await prerender(ui)
    return await new Response(prelude).text()
  } finally {
    g.window = w
  }
}

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

beforeEach(() => {
  renders = 0
  loader.mockClear()
  loader.mockClear()
})
afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

const mount = async (hydrate: 'load' | 'visible', strict = false) => {
  const html = await serverHtml(<Island name="counter" props={{ start: 3 }} hydrate={hydrate} />)
  expect(html).toContain('count 3')
  renders = 0
  loader.mockClear()
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  const ui = <Island name="counter" props={{ start: 3 }} hydrate={hydrate} />
  let root!: ReturnType<typeof hydrateRoot>
  await act(async () => {
    root = hydrateRoot(host, strict ? <StrictMode>{ui}</StrictMode> : ui)
  })
  return { host, root, button: host.querySelector('button')! }
}

describe('Island', () => {
  it('server-renders full HTML and renders on the client only after the trigger, keeping the DOM', async () => {
    let fire!: (entries: { isIntersecting: boolean }[]) => void
    vi.stubGlobal('IntersectionObserver', class { constructor(cb: typeof fire) { fire = cb } observe() {} disconnect() {} })
    const { host, button, root } = await mount('visible')
    await flush()
    expect(renders).toBe(0)
    expect(loader).not.toHaveBeenCalled()

    await act(async () => root.render(<Island name="counter" props={{ start: 3 }} hydrate="visible" />)) // wrapper re-render
    expect(host.querySelector('button')).toBe(button)

    await act(async () => fire([{ isIntersecting: true }]))
    await flush()
    expect(loader).toHaveBeenCalledOnce()
    expect(renders).toBe(1)
    expect(host.querySelector('button')).toBe(button)
  })

  it('StrictMode double effects and same-node remount hydrate once', async () => {
    const { root } = await mount('load', true)
    await flush()
    await act(async () => root.render(<StrictMode><Island name="counter" props={{ start: 3 }} hydrate="load" /></StrictMode>))
    await flush()
    expect(loader).toHaveBeenCalledOnce()
    expect(renders).toBeGreaterThan(0)
    expect(renders).toBeLessThanOrEqual(2) // StrictMode double render inside the one root
  })

  it('a load resolving after unmount creates no root; a remount hydrates once', async () => {
    const resolvers: (() => void)[] = []
    loader.mockImplementation(() => new Promise((r) => resolvers.push(() => r({ default: Counter }))))
    const { host, root } = await mount('load')
    await flush()
    await act(async () => root.render(null)) // unmount wrapper, deferred cleanup runs
    await flush()
    host.innerHTML = await serverHtml(<Island name="counter" props={{ start: 3 }} hydrate="load" />)
    loader.mockClear()
    const again = hydrateRoot(host, <Island name="counter" props={{ start: 3 }} hydrate="load" />)
    await flush()
    renders = 0
    await act(async () => resolvers.forEach((r) => r()))
    await flush()
    expect(renders).toBe(1) // stale first load dropped, only the remount's activation hydrated
    again.unmount()
    loader.mockImplementation(async () => ({ default: Counter }))
  })

  it('unknown name throws IslandNotFound', async () => {
    // @ts-expect-error unknown name is a type error
    await expect(serverHtml(<Island name="nope" props={{}} />)).rejects.toBeInstanceOf(IslandNotFound)
  })

  it('chunk failure keeps the dormant HTML and logs', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const Broken = defineIslands({ counter: loader })
    const html = await serverHtml(<Broken name="counter" props={{ start: 1 }} hydrate="load" />)
    loader.mockRejectedValueOnce(new Error('offline'))
    const host = document.createElement('div')
    host.innerHTML = html
    document.body.append(host)
    await act(async () => { hydrateRoot(host, <Broken name="counter" props={{ start: 1 }} hydrate="load" />) })
    await flush()
    expect(host.textContent).toContain('count 1')
    expect(err).toHaveBeenCalledWith(expect.stringContaining('chunk failed'), expect.any(Error))
  })
})

describe('arm', () => {
  it('visible keeps observing a hidden container and fires once when shown', () => {
    let cb!: (e: { isIntersecting: boolean }[]) => void
    const disconnect = vi.fn()
    vi.stubGlobal('IntersectionObserver', class { constructor(c: typeof cb) { cb = c } observe() {} disconnect = disconnect })
    const fire = vi.fn()
    arm(document.createElement('div'), 'visible', fire)
    cb([{ isIntersecting: false }])
    expect(fire).not.toHaveBeenCalled()
    cb([{ isIntersecting: true }])
    expect(fire).toHaveBeenCalledOnce()
    expect(disconnect).toHaveBeenCalled()
  })

  it.each(['load', 'visible'] as const)('%s fires on a microtask without IntersectionObserver', async (t) => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const fire = vi.fn()
    arm(document.createElement('div'), t, fire)
    expect(fire).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(fire).toHaveBeenCalledOnce()
  })
})
