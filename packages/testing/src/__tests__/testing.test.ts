import { el, renderToString, useEffect, useLocal } from '@sleekstack/ui'
import { Cause, Context, Effect, Exit, Layer } from 'effect'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { describe, expect, it } from 'vitest'
import { flush, FlushTimeout, mockLayer, render } from '../index'

class Repo extends Context.Tag('Repo')<
  Repo,
  {
    readonly name: () => Effect.Effect<string>
    readonly save: (name: string) => Effect.Effect<void>
    readonly toString: () => string
  }
>() {}

const Name = Effect.flatMap(Repo, (repo) => Effect.map(repo.name(), (name) => el('h1', {}, name)))
const actFlag = () => (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT

describe('render', () => {
  it('renders with a Layer into an attached container; dispose empties and detaches it', async () => {
    const { container, dispose } = await render(Name, { layer: mockLayer(Repo, { name: () => Effect.succeed('Ada') }) })
    expect(container.innerHTML).toBe('<h1>Ada</h1>')
    expect(document.body.contains(container)).toBe(true)
    await dispose()
    expect(container.innerHTML).toBe('')
    expect(document.body.contains(container)).toBe(false)
  })

  it('turns the act flag on while rendered and restores the previous value on manual dispose', async () => {
    expect(actFlag()).toBeUndefined()
    const first = await render(Effect.succeed(el('p', {})), { layer: Layer.empty })
    const second = await render(Effect.succeed(el('p', {})), { layer: Layer.empty })
    expect(actFlag()).toBe(true)
    await first.dispose()
    expect(actFlag()).toBe(true)
    await second.dispose()
    expect(actFlag()).toBeUndefined()
  })

  it('keeps the act flag on while another render is in flight when one render fails', async () => {
    let open!: () => void
    const gate = new Promise<void>((r) => (open = r))
    const slow = render(Effect.succeed(el('p', {})), { layer: Layer.effectDiscard(Effect.promise(() => gate)) })
    await expect(render(Effect.succeed(el('p', {})), { layer: Layer.fail('boom') })).rejects.toBeDefined()
    expect(actFlag()).toBe(true)
    open()
    await (await slow).dispose()
    expect(actFlag()).toBeUndefined()
  })

  it('a rejecting dispose still detaches the container and restores the act flag', async () => {
    const layer = Layer.scopedDiscard(Effect.addFinalizer(() => Effect.die('finalizer failed')))
    const { container, dispose } = await render(Effect.succeed(el('p', {})), { layer })
    await dispose().catch(() => {})
    expect(document.body.contains(container)).toBe(false)
    expect(actFlag()).toBeUndefined()
  })

  let leftOver: HTMLElement | undefined
  it('leaves a render undisposed', async () => {
    leftOver = (await render(Effect.succeed(el('p', {}, 'left')), { layer: Layer.empty })).container
  })
  it('auto-disposes after each test through the single afterEach hook', () => {
    expect(leftOver?.innerHTML).toBe('')
    expect(document.body.contains(leftOver!)).toBe(false)
    expect(actFlag()).toBeUndefined()
  })

  it('hydrates server HTML, keeping the server nodes', async () => {
    const app = Effect.succeed(el('section', {}, el('b', {}, 'hi')))
    const html = await renderToString(app, { layer: Layer.empty })
    const { container } = await render(app, { layer: Layer.empty, hydrate: html })
    const bold = container.querySelector('b')
    expect(bold?.textContent).toBe('hi')
    expect(container.innerHTML).toBe(html)
  })
})

describe('flush', () => {
  it('settles re-runs that post-commit effects schedule across macrotasks', async () => {
    const Counter = () =>
      Effect.flatMap(useLocal(0), ([n, set]) =>
        Effect.as(
          useEffect(() => void (n < 3 && setTimeout(() => set(n + 1), 0)), [n]),
          el('i', {}, String(n)),
        ),
      )
    const { container } = await render(jsx(Counter, {}), { layer: Layer.empty })
    expect(container.textContent).not.toBe('3')
    await flush()
    expect(container.textContent).toBe('3')
  })

  it('fails with FlushTimeout when the DOM never settles', async () => {
    const churn = setInterval(() => document.body.append('x'), 0)
    try {
      await expect(flush(5)).rejects.toEqual(new FlushTimeout({ rounds: 5 }))
    } finally {
      clearInterval(churn)
      document.body.textContent = ''
    }
  })
})

describe('mockLayer', () => {
  it('calling an unsupplied method is a defect naming it', () => {
    const exit = Effect.runSyncExit(
      Effect.provide(
        Effect.flatMap(Repo, (repo) => repo.save('x')),
        mockLayer(Repo, {}),
      ),
    )
    const missing = Effect.runSyncExit(
      Effect.provide(
        Effect.flatMap(Repo, (repo) => Effect.sync(() => repo.toString())),
        mockLayer(Repo, {}),
      ),
    )
    expect(String(Exit.isFailure(missing) && Cause.squash(missing.cause))).toContain('Repo.toString is not implemented')
    const defect = Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined
    expect(String(defect)).toContain('mockLayer: Repo.save is not implemented')
  })
})
