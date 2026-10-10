import { el, Pending, useEffect, useLocal } from '@sleekstack/ui'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { screen, within } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { Context, Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { flush, mockLayer, render } from '../index'

class Greeter extends Context.Tag('Greeter')<Greeter, { readonly greet: () => Effect.Effect<string> }>() {}

const Counter = () =>
  Effect.flatMap(useLocal(0), ([n, set]) => jsx('button', { onClick: () => set(n + 1), children: `Clicked ${n}` }))

describe('component tests with Testing Library', () => {
  it('renders, and role/text queries find the output', async () => {
    const Hello = Effect.flatMap(Greeter, (g) => Effect.map(g.greet(), (text) => el('h1', {}, text)))
    const { container } = await render(Hello, { layer: mockLayer(Greeter, { greet: () => Effect.succeed('Hi Ada') }) })
    expect(within(container).getByRole('heading', { name: 'Hi Ada' })).toBeDefined()
    expect(screen.getByText('Hi Ada')).toBeDefined()
  })

  it('a click through user-event re-renders', async () => {
    const { container } = await render(jsx(Counter, {}), { layer: Layer.empty })
    await userEvent.click(within(container).getByRole('button', { name: 'Clicked 0' }))
    await flush()
    expect(within(container).getByRole('button').textContent).toBe('Clicked 1')
  })

  it('runs effect cleanup on dispose', async () => {
    const log: Array<string> = []
    const Logged = () =>
      Effect.as(
        useEffect(() => (log.push('mount'), () => void log.push('cleanup')), []),
        el('p', {}),
      )
    const { dispose } = await render(jsx(Logged, {}), { layer: Layer.empty })
    await flush()
    expect(log).toEqual(['mount'])
    await dispose()
    expect(log).toEqual(['mount', 'cleanup'])
  })

  it('shows the Pending fallback, then the async content', async () => {
    let open!: () => void
    const gate = new Promise<void>((r) => (open = r))
    const Slow = () =>
      Effect.as(
        Effect.promise(() => gate),
        el('b', {}, 'loaded'),
      )
    const { container } = await render(
      jsx(Pending, { fallback: jsx('i', { children: 'loading' }), children: jsx(Slow, {}) }),
      {
        layer: Layer.empty,
      },
    )
    expect(within(container).getByText('loading')).toBeDefined()
    open()
    await flush()
    expect(within(container).getByText('loaded')).toBeDefined()
    expect(within(container).queryByText('loading')).toBeNull()
  })
})
