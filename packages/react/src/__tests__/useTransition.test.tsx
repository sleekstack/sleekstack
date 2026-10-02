/**
 * packages/react/src/__tests__/useTransition.test.tsx
 *
 * useEffectTransition: provider services, latest-wins interruption, unmount interruption, typed failures.
 */
import { afterEach, describe, it, expect } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import React, { Suspense } from 'react'
import { Cause, Context, Effect, Exit, Layer } from 'effect'
import { LayerProvider, useEffectTransition } from '../index'

const Api = Context.GenericTag<{ find: (q: string) => Effect.Effect<string, 'Offline'> }>('TransitionApi')
const ApiLive = Layer.succeed(Api, { find: (q) => (q === 'bad' ? Effect.fail('Offline' as const) : Effect.succeed(`found:${q}`)) })

function setup(log: string[]) {
  let send!: (q: string) => unknown
  const View = () => {
    const [text, setText] = React.useState('')
    const [pending, run] = useEffectTransition(
      (q: string) =>
        Effect.gen(function* () {
          yield* Effect.sleep(q === 'slow' ? '1 hour' : '1 millis')
          return yield* (yield* Api).find(q)
        }).pipe(Effect.onInterrupt(() => Effect.sync(() => void log.push(`interrupted:${q}`)))),
      Exit.match({
        onSuccess: (v) => setText(v),
        onFailure: (c) => setText(Cause.isFailType(c) ? `err:${c.error}` : 'defect'),
      }),
    )
    send = run
    return <span data-testid="t">{pending ? 'pending' : text}</span>
  }
  const ui = (
    <LayerProvider provide={[ApiLive]}>
      <Suspense fallback={null}><View /></Suspense>
    </LayerProvider>
  )
  return { ui, send: (q: string) => act(async () => void send(q)) }
}

afterEach(cleanup)

describe('useEffectTransition', () => {
  it('runs with provider services and commits the success', async () => {
    const { ui, send } = setup([])
    render(ui)
    await screen.findByTestId('t')
    await send('a')
    await waitFor(() => expect(screen.getByTestId('t').textContent).toBe('found:a'))
  })

  it('replays a send made before the mount effect ran', async () => {
    const Early = () => {
      const [, run] = useEffectTransition((q: string) => Effect.succeed(q), (e) => { if (Exit.isSuccess(e)) got.push(e.value) })
      React.useState(() => run('early')) // during render, before any effect
      return null
    }
    const got: string[] = []
    render(<LayerProvider provide={[]}><Suspense fallback={null}><Early /></Suspense></LayerProvider>)
    await waitFor(() => expect(got).toEqual(['early']))
  })

  it('commits a typed failure as an Exit', async () => {
    const { ui, send } = setup([])
    render(ui)
    await screen.findByTestId('t')
    await send('bad')
    await waitFor(() => expect(screen.getByTestId('t').textContent).toBe('err:Offline'))
  })

  it('a newer send interrupts the in-flight run', async () => {
    const log: string[] = []
    const { ui, send } = setup(log)
    render(ui)
    await screen.findByTestId('t')
    await send('slow')
    expect(screen.getByTestId('t').textContent).toBe('pending')
    await send('b')
    await waitFor(() => expect(screen.getByTestId('t').textContent).toBe('found:b'))
    expect(log).toEqual(['interrupted:slow'])
  })

  it('unmount interrupts the in-flight run', async () => {
    const log: string[] = []
    const { ui, send } = setup(log)
    const { unmount } = render(ui)
    await screen.findByTestId('t')
    await send('slow')
    unmount()
    await waitFor(() => expect(log).toEqual(['interrupted:slow']))
  })
})
