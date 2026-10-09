import { flush, render } from '@sleekstack/testing'
import { useLocal } from '@sleekstack/ui'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { within } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { Effect, Layer } from 'effect'
import { expect, it } from 'vitest'

const Counter = () =>
  Effect.flatMap(useLocal(0), ([n, set]) => jsx('button', { onClick: () => set(n + 1), children: `Clicked ${n}` }))

it('counts clicks', async () => {
  const { container } = await render(jsx(Counter, {}), { layer: Layer.empty })
  await userEvent.click(within(container).getByRole('button', { name: 'Clicked 0' }))
  await flush()
  expect(within(container).getByRole('button').textContent).toBe('Clicked 1')
})
