// @vitest-environment jsdom
/** @jsxImportSource @sleekstack/ui */
import { hydrateMount, type Ref, renderToString } from '@sleekstack/ui'
import { Layer } from 'effect'
import { act } from 'react'
import { expect, it, vi } from 'vitest'
import { TypedDomDemo } from '../src/pages/dom'

it('server-renders typed attributes, hydrates, binds the size atom in place and focuses through a ref', async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  container.innerHTML = await renderToString(<TypedDomDemo />, { layer: Layer.empty })
  document.body.append(container)
  const meter = container.querySelector('meter')!
  expect([meter.getAttribute('max'), meter.getAttribute('value')]).toEqual(['5', '3'])
  const onError = vi.fn()
  const h = await act(() => hydrateMount(<TypedDomDemo />, { layer: Layer.empty, container, onError }))
  expect(container.querySelector('meter')).toBe(meter)

  const range = container.querySelector<HTMLInputElement>('input.size')!
  range.value = '5'
  await act(async () => void range.dispatchEvent(new Event('input', { bubbles: true })))
  expect(meter.getAttribute('value')).toBe('5')

  await act(async () => container.querySelector<HTMLButtonElement>('button.focus')!.click())
  expect(document.activeElement).toBe(container.querySelector('input.note'))
  expect(onError).not.toHaveBeenCalled()
  await act(() => h.dispose())
  container.remove()
})

// ADR 0031: each line is a tsc error, so `pnpm typecheck` fails if the types loosen. Never called.
export const typeErrors = (note: Ref<HTMLInputElement>) => [
  // @ts-expect-error a meter has no `checked`
  <meter checked />,
  // @ts-expect-error not an input type
  <input type="banana" />,
  // @ts-expect-error an input's ref box on a button
  <button ref={note} />,
  // @ts-expect-error a click's currentTarget is the button, which has no `valueAsNumber`
  <button onClick={(e) => e.currentTarget.valueAsNumber} />,
]
