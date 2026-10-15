// @vitest-environment jsdom
import { hydrateMount, renderToString } from '@sleekstack/ui'
import { act } from 'react'
import { expect, it, vi } from 'vitest'
import { App } from '../src/app'
import { AppWithQueriesLive } from '../src/layers'

const live = () => AppWithQueriesLive({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } })

const hydrateApp = async () => {
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
  return { container, sort, onError, dispose: async () => (await h.dispose(), container.remove()) }
}

it('hydrates the server-rendered app: server nodes are kept, no mismatch, events work', async () => {
  const { container, sort, onError, dispose } = await hydrateApp()
  const before = container.textContent
  await act(async () => sort.click())
  await vi.waitFor(() => expect(container.textContent).not.toBe(before))
  expect(onError).not.toHaveBeenCalled()
  await dispose()
})

it('the hydrated new-task form runs its action: the title optimistically, then the task on the board', async () => {
  const { container, onError, dispose } = await hydrateApp()
  container.querySelector<HTMLInputElement>('.new-title')!.value = 'Rotate the API keys'
  await act(async () => container.querySelector<HTMLFormElement>('form.add')!.requestSubmit())
  expect(container.querySelector('.adding')!.textContent).toBe('Adding "Rotate the API keys"')
  await vi.waitFor(() => expect(container.querySelectorAll('.board .card')).toHaveLength(5))
  expect(onError).not.toHaveBeenCalled()
  await dispose()
})
