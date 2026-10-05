// @vitest-environment jsdom
import { hydrateMount, renderToString } from '@sleekstack/ui'
import { act } from 'react'
import { expect, it, vi } from 'vitest'
import { App } from '../src/app'
import { AppWithQueriesLive } from '../src/infrastructure'

const live = () => AppWithQueriesLive({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } })

it('hydrates the server-rendered app: server nodes are kept, no mismatch, events work', async () => {
  const container = document.createElement('div')
  container.innerHTML = await renderToString(App({ viewer: 'u1' }), { layer: live() })
  document.body.append(container)
  const h2 = container.querySelector('h2')!
  const sort = container.querySelector<HTMLButtonElement>('button.sort')!
  const onError = vi.fn()
  const h = await act(() => hydrateMount(App({ viewer: 'u1' }), { layer: live(), container, onError }))
  expect(onError).not.toHaveBeenCalled()
  expect(container.querySelector('script[data-sleek-hydrate]')).toBeNull()
  expect(container.querySelector('h2')).toBe(h2)
  expect(container.querySelector('button.sort')).toBe(sort)
  const before = container.textContent
  await act(async () => sort.click())
  await vi.waitFor(() => expect(container.textContent).not.toBe(before))
  expect(onError).not.toHaveBeenCalled()
  await h.dispose()
})
