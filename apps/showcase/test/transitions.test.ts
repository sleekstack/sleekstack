// @vitest-environment jsdom
import { hydrateMount, mount, renderToString } from '@sleekstack/ui'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { Layer } from 'effect'
import { act } from 'react'
import { expect, it, vi } from 'vitest'
import { TransitionsDemo } from '../src/pages/transitions'

const app = () => jsx(TransitionsDemo, {})
// Each tab's content takes a simulated 300 ms round trip.
const loaded = { timeout: 2000 }

const go = async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const container = document.body.appendChild(document.createElement('div'))
  const m = await act(() => mount(app(), { layer: Layer.empty, container }))
  const q = <T extends Element>(s: string) => container.querySelector<T>(s)!
  const click = (s: string) => act(async () => q<HTMLElement>(s).click())
  await vi.waitFor(() => expect(q('.tab-content').textContent).toBe('Overview loaded'), loaded)
  return { container, q, click, dispose: async () => (await act(() => m.dispose()), container.remove()) }
}

it('a tab opened in a transition keeps the old tab until it loads; an ordinary write shows the fallback', async () => {
  const { q, click, dispose } = await go()
  await click('button[data-tab="Activity"]')
  expect(q('.tabs').textContent).toContain('Overview loaded')
  expect(q('.tabs').textContent).not.toContain('Loading')
  await vi.waitFor(() => expect(q('.tab-content').textContent).toBe('Activity loaded'), loaded)

  await click('input.smooth')
  await click('button[data-tab="Members"]')
  expect(q('.tabs').textContent).toContain('Loading Members')
  await vi.waitFor(() => expect(q('.tab-content').textContent).toBe('Members loaded'), loaded)
  await dispose()
})

it('the matches follow the query one commit after the input', async () => {
  const { container, q, dispose } = await go()
  const commits: Array<[string, string]> = []
  const observer = new MutationObserver(() => commits.push([q('.typed').textContent!, q('.count').textContent!]))
  observer.observe(container, { subtree: true, childList: true, characterData: true })
  const input = q<HTMLInputElement>('input.query')
  input.value = '99'
  await act(async () => void input.dispatchEvent(new Event('input', { bubbles: true })))
  await vi.waitFor(() => expect(commits.at(-1)).toEqual(['Typed "99"', '19 rows match "99"']))
  expect(commits[0]).toEqual(['Typed "99"', '1000 rows match ""'])
  observer.disconnect()
  await dispose()
})

it('renders on the server, with the deferred query equal to its source, and hydrates in place', async () => {
  const container = document.createElement('div')
  container.innerHTML = await renderToString(app(), { layer: Layer.empty })
  const content = container.querySelector('.tab-content')!
  expect(content.textContent).toBe('Overview loaded')
  expect(container.querySelector('.count')!.textContent).toBe('1000 rows match ""')
  const onError = vi.fn()
  const h = await act(() => hydrateMount(app(), { layer: Layer.empty, container, onError }))
  await vi.waitFor(() => expect(container.querySelector('.tab-content')).toBe(content), loaded)
  expect(onError).not.toHaveBeenCalled()
  await act(() => h.dispose())
})
