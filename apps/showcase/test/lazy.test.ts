// @vitest-environment jsdom
import { hydrateMount, mount, renderToString } from '@sleekstack/ui'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { Layer } from 'effect'
import { act } from 'react'
import { expect, it, vi } from 'vitest'
import { LazyDemo } from '../src/pages/lazy'

// The chart's first import fails, as a dropped request would.
const network = vi.hoisted(() => ({ drop: 1 }))
vi.mock('../src/pages/chart', async (original) => {
  if (network.drop-- > 0) throw new Error('Failed to fetch')
  return original()
})

const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))
const app = () => jsx(LazyDemo, {})

// Runs first: once the import succeeds, `lazy` keeps the module.
it('a failed import shows Retry, which imports the chart again', async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  const onError = vi.fn()
  const m = await act(() => mount(app(), { layer: Layer.empty, container, onError }))
  await vi.waitFor(() => expect(container.querySelector('.error')?.textContent).toBe('The chart failed to load. Retry'))
  await act(async () => container.querySelector<HTMLButtonElement>('button.retry')!.click())
  await settle()
  await vi.waitFor(() => expect(container.querySelectorAll('svg.chart rect')).toHaveLength(6))
  expect(onError).not.toHaveBeenCalled()
  await act(() => m.dispose())
})

it('renders the chart on the server and hydrates it in place', async () => {
  const container = document.createElement('div')
  container.innerHTML = await renderToString(app(), { layer: Layer.empty })
  const svg = container.querySelector('svg.chart')
  expect(svg).not.toBeNull()
  const onError = vi.fn()
  const h = await act(() => hydrateMount(app(), { layer: Layer.empty, container, onError }))
  expect(container.querySelector('svg.chart')).toBe(svg)
  expect(onError).not.toHaveBeenCalled()
  await act(() => h.dispose())
})
