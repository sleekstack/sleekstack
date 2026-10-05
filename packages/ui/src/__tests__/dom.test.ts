// @vitest-environment jsdom
import { Cause, Deferred, Effect, Layer } from 'effect'
import { act, createElement } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { el, fragment, fromReact, mount, type Mounted } from '../index'
import { app, UserCard, UserNotFound, UserRepo, UserRepoTest } from './fixtures/user-card'

const card = (name: string) =>
  `<div class="card"><h2>${name}</h2><sleek-guest style="display: contents;"><span class="avatar">${name}</span></sleek-guest></div>`

let handles: Array<Mounted> = []
const track = (m: Mounted) => (handles.push(m), m)

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})
afterEach(async () => {
  await act(async () => {
    for (const h of handles) await h.dispose()
  })
  handles = []
})

const repoLayer = (name: string) => Layer.succeed(UserRepo, { get: () => Effect.succeed({ name }) })

describe('mount', () => {
  it('mounts UserCard with the expected DOM, and the Catch fallback', async () => {
    const container = document.createElement('div')
    await act(async () => void track(await mount(app('1'), { layer: UserRepoTest, container })))
    expect(container.innerHTML).toBe(card('Ada'))
    await act(async () => void track(await mount(app('2'), { layer: UserRepoTest, container })))
    expect(container.innerHTML).toBe('<p>Not found</p>')
  })

  it('guest DOM exists when the mount promise resolves, before act flushes', async () => {
    const container = document.createElement('div')
    let seen = ''
    await act(async () => {
      track(await mount(app('1'), { layer: UserRepoTest, container }))
      seen = container.innerHTML
    })
    expect(seen).toBe(card('Ada'))
  })

  it('re-mount replaces content and unmounts old roots; disposing the obsolete handle is a no-op', async () => {
    const container = document.createElement('div')
    const errors = vi.spyOn(console, 'error')
    let a!: Mounted
    let b!: Mounted
    await act(async () => void (a = await mount(app('1'), { layer: repoLayer('A'), container })))
    await act(async () => void (b = track(await mount(app('1'), { layer: repoLayer('B'), container }))))
    expect(container.innerHTML).toBe(card('B'))
    await act(() => a.dispose())
    expect(container.innerHTML).toBe(card('B'))
    await act(() => b.dispose())
    expect(container.innerHTML).toBe('')
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })

  it('a superseded in-flight mount writes nothing and its handle disposes as a no-op', async () => {
    const container = document.createElement('div')
    const gate = Effect.runSync(Deferred.make<void>())
    const slow = Layer.effect(
      UserRepo,
      Effect.as(Deferred.await(gate), { get: () => Effect.succeed({ name: 'Slow' }) }),
    )
    const first = mount(app('1'), { layer: slow, container })
    await act(async () => void track(await mount(app('1'), { layer: repoLayer('B'), container })))
    let late!: Mounted
    await act(async () => {
      Effect.runSync(Deferred.succeed(gate, undefined))
      late = await first
    })
    expect(container.innerHTML).toBe(card('B'))
    await act(() => late.dispose())
    expect(container.innerHTML).toBe(card('B'))
  })

  it('a throwing guest renders as nothing, reaches onError, and mount resolves', async () => {
    const container = document.createElement('div')
    const Bad = fromReact((): never => {
      throw new Error('guest')
    })
    const tree = Effect.map(Bad({}), (b) => fragment('a', b, 'b'))
    const onError = vi.fn()
    await act(async () => void track(await mount(tree, { layer: Layer.empty, container, onError })))
    expect(container.textContent).toBe('ab')
    expect(Cause.squash(onError.mock.calls[0]![0])).toMatchObject({ message: 'guest' })
  })

  it('a DOM error renders as nothing and reaches onError', async () => {
    const container = document.createElement('div')
    const onError = vi.fn()
    const tree = Effect.succeed(el('div', {}, el('bad tag'), 'ok'))
    await act(async () => void track(await mount(tree, { layer: Layer.empty, container, onError })))
    expect(container.innerHTML).toBe('<div>ok</div>')
    expect(onError).toHaveBeenCalledOnce()
  })

  it('a rejecting re-mount still clears the previous mount', async () => {
    const container = document.createElement('div')
    await act(async () => void (await mount(app('1'), { layer: UserRepoTest, container })))
    let err: unknown
    await act(
      async () => void (err = await mount(UserCard({ id: '2' }), { layer: UserRepoTest, container }).catch((e) => e)),
    )
    expect(err).toBeInstanceOf(UserNotFound)
    expect(container.innerHTML).toBe('')
  })

  it('a mount superseded from onError during build writes nothing', async () => {
    const container = document.createElement('div')
    const Bad = fromReact((): never => {
      throw new Error('guest')
    })
    let next: Promise<Mounted> | undefined
    const onError = () => void (next ??= mount(app('1'), { layer: repoLayer('B'), container }))
    await act(async () => {
      track(
        await mount(
          Effect.map(Bad({}), (b) => fragment('stale', b)),
          { layer: Layer.empty, container, onError },
        ),
      )
      expect(container.innerHTML).toBe('')
      track(await next!)
    })
    expect(container.innerHTML).toBe(card('B'))
  })

  it.each([
    ['onerror', 'alert(1)'],
    ['srcdoc', '<script></script>'],
    ['href', ' JavaScript:alert(1)'],
  ])('rejects the unsafe attribute %s as a render error', async (name, value) => {
    const container = document.createElement('div')
    const onError = vi.fn()
    const tree = Effect.succeed(el('div', {}, el('a', { [name]: value }), 'ok'))
    await act(async () => void track(await mount(tree, { layer: Layer.empty, container, onError })))
    expect(container.innerHTML).toBe('<div>ok</div>')
    expect(onError).toHaveBeenCalledOnce()
  })

  it('an uncaught UserNotFound rejects with the original instance', async () => {
    const container = document.createElement('div')
    const err = await mount(UserCard({ id: '2' }), { layer: UserRepoTest, container }).catch((e) => e)
    expect(err).toBeInstanceOf(UserNotFound)
  })
})
