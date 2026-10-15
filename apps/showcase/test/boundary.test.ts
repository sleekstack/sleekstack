// @vitest-environment jsdom
import { flush, render } from '@sleekstack/testing'
import { renderToString } from '@sleekstack/ui'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { Layer } from 'effect'
import { act } from 'react'
import { expect, it, vi } from 'vitest'
import { BoundaryDemo } from '../src/pages/boundary'

const app = () => jsx(BoundaryDemo, {})

/** The first read shows the fallback; Retry re-runs the boundary's children and the feed loads. */
const retry = async (container: HTMLElement) => {
  expect(container.querySelector('.boundary .error')!.textContent).toBe('The request dropped. Retry')
  await act(async () => container.querySelector<HTMLButtonElement>('button.retry')!.click())
  await flush()
  expect(container.querySelector('.boundary .error')).toBeNull()
  expect(container.querySelector('.feed')!.textContent).toBe('Loaded on attempt 2')
}

it('a failed read shows the fallback; Retry resets the boundary and the read succeeds', async () => {
  const onError = vi.fn()
  const { container, dispose } = await render(app(), { layer: Layer.empty, onError })
  await retry(container)
  expect(onError).not.toHaveBeenCalled()
  await dispose()
})

it('renders the fallback on the server and retries after hydration', async () => {
  const html = await renderToString(app(), { layer: Layer.empty })
  expect(html).toContain('<button type="button" class="retry">Retry</button>')
  const onError = vi.fn()
  const { container, dispose } = await render(app(), { layer: Layer.empty, hydrate: html, onError })
  await retry(container)
  expect(onError).not.toHaveBeenCalled()
  await dispose()
})
