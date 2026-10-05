import { act, StrictMode } from 'react'
import { prerender } from 'react-dom/static'
import { hydrateRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineIslands, IslandNotFound } from '../index'
import { arm, type Trigger } from '../triggers'

let renders = 0
let clicks = 0
const Counter = ({ start }: { start: number }) => {
  renders++
  return <button type="button" onClick={() => clicks++}>{`count ${start}`}</button>
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

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })

beforeEach(() => {
  renders = 0
  clicks = 0
  loader.mockClear()
})
afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

const mount = async (hydrate: Trigger, strict = false) => {
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
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: typeof fire) {
          fire = cb
        }
        observe() {}
        disconnect() {}
      },
    )
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
    await act(async () =>
      root.render(
        <StrictMode>
          <Island name="counter" props={{ start: 3 }} hydrate="load" />
        </StrictMode>,
      ),
    )
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

  it('interaction: a pre-hydration click runs its handler exactly once; a second click while loading is dropped', async () => {
    const { button } = await mount('interaction')
    await flush()
    expect(loader).not.toHaveBeenCalled()
    await act(async () => {
      button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      button.click()
      button.click() // while loading
    })
    await flush()
    expect(loader).toHaveBeenCalledOnce()
    expect(clicks).toBe(1)
    await act(async () => button.click()) // hydrated: normal React handling
    expect(clicks).toBe(2)
  })

  it.each(['keydown', 'focusin'])('interaction: %s only starts hydration', async (type) => {
    const { button } = await mount('interaction')
    await act(async () => {
      button.dispatchEvent(new Event(type, { bubbles: true }))
    })
    await flush()
    expect(loader).toHaveBeenCalledOnce()
    expect(renders).toBe(1)
    expect(clicks).toBe(0)
  })

  it('interaction retries on the next event after a chunk failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { button } = await mount('interaction')
    loader.mockRejectedValueOnce(new Error('offline'))
    await act(async () => button.click())
    await flush()
    expect(renders).toBe(0)
    await act(async () => button.click())
    await flush()
    expect(loader).toHaveBeenCalledTimes(2)
    expect(renders).toBe(1)
    expect(clicks).toBe(1)
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
    await act(async () => {
      hydrateRoot(host, <Broken name="counter" props={{ start: 1 }} hydrate="load" />)
    })
    await flush()
    expect(host.textContent).toContain('count 1')
    expect(err).toHaveBeenCalledWith(expect.stringContaining('chunk failed'), expect.any(Error))
  })
})

describe('arm', () => {
  it('visible keeps observing a hidden container and fires once when shown', () => {
    let cb!: (e: { isIntersecting: boolean }[]) => void
    const disconnect = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(c: typeof cb) {
          cb = c
        }
        observe() {}
        disconnect = disconnect
      },
    )
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

  it('idle fires via requestIdleCallback with a timeout cap', () => {
    let cb!: () => void
    const ric = vi.fn((c: () => void, _o?: { timeout: number }) => {
      cb = c
      return 1
    })
    vi.stubGlobal('requestIdleCallback', ric)
    vi.stubGlobal('cancelIdleCallback', vi.fn())
    const fire = vi.fn()
    arm(document.createElement('div'), 'idle', fire)
    expect(ric.mock.calls[0]![1]).toEqual({ timeout: expect.any(Number) })
    expect(fire).not.toHaveBeenCalled()
    cb()
    expect(fire).toHaveBeenCalledOnce()
  })

  it('idle falls back to setTimeout without requestIdleCallback', async () => {
    vi.stubGlobal('requestIdleCallback', undefined)
    const fire = vi.fn()
    arm(document.createElement('div'), 'idle', fire)
    expect(fire).not.toHaveBeenCalled()
    await new Promise((r) => setTimeout(r, 5))
    expect(fire).toHaveBeenCalledOnce()
  })

  it('visible passes rootMargin to IntersectionObserver', () => {
    const init = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(_c: unknown, o: unknown) {
          init(o)
        }
        observe() {}
        disconnect() {}
      },
    )
    arm(document.createElement('div'), 'visible', vi.fn(), { rootMargin: '200px' })
    expect(init).toHaveBeenCalledWith({ rootMargin: '200px' })
  })

  it('interaction fires on each listed event, captured on the container, until disarmed', () => {
    const el = document.createElement('div')
    const child = el.appendChild(document.createElement('span'))
    const fire = vi.fn()
    const disarm = arm(el, 'interaction', fire)
    for (const t of ['pointerdown', 'touchstart', 'focusin', 'keydown', 'click']) child.dispatchEvent(new Event(t))
    expect(fire.mock.calls.map(([e]) => (e as Event).type)).toEqual([
      'pointerdown',
      'touchstart',
      'focusin',
      'keydown',
      'click',
    ])
    disarm()
    child.dispatchEvent(new Event('click'))
    expect(fire).toHaveBeenCalledTimes(5)
  })
})
