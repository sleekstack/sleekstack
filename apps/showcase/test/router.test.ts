// @vitest-environment jsdom
// Also the showcase's `@sleekstack/testing` example: `render` mounts a page, `flush` waits out renderer work and
// `mockLayer` stands in for the identity module's UserRepo.
import { handle, startRouter } from '@sleekstack/router'
import { flush, mockLayer, render } from '@sleekstack/testing'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { Effect } from 'effect'
import { act } from 'react'
import { beforeAll, expect, it, vi } from 'vitest'
import { type User, UserRepo } from '../src/modules/identity'
import { people, RouterDemo } from '../src/pages/router'

const team: ReadonlyArray<User> = [
  { id: 'u1', name: 'Ada', canEdit: true },
  { id: 'u2', name: 'Grace', canEdit: false },
  { id: 'u3', name: 'Linus', canEdit: true },
]
const repo = () => {
  const get = vi.fn((id: string) => Effect.succeed(team.find((u) => u.id === id)!))
  return { get, layer: mockLayer(UserRepo, { all: () => Effect.succeed(team), get }) }
}
const loaded = { timeout: 2000 }
beforeAll(() => {
  window.scrollTo = vi.fn() as never // a navigation scrolls; jsdom has no layout
})

it('the router follows its Links in the page; a hovered Link is prefetched, so its click needs no load', async () => {
  history.replaceState(null, '', '/')
  const { get, layer } = repo()
  const { container, dispose } = await render(jsx(RouterDemo, {}), { layer })
  await flush()
  const link = (id: string) => container.querySelector<HTMLAnchorElement>(`.routed a[href="/people/${id}"]`)!
  const profile = () => container.querySelector('.profile')?.textContent
  await vi.waitFor(() => expect(link('u2')).not.toBeNull())

  link('u2').dispatchEvent(new MouseEvent('mouseenter'))
  await vi.waitFor(() => expect(get).toHaveBeenCalledWith('u2'), loaded)
  await act(async () => link('u2').click())
  await vi.waitFor(() => expect([location.pathname, profile()]).toEqual(['/people/u2', 'Grace reads the board']))
  expect(get).toHaveBeenCalledTimes(1) // the navigation read the prefetched result

  await act(async () => link('u3').click())
  expect(profile()).toBe('Grace reads the board') // the next page shows once its loader settles
  await vi.waitFor(() => expect(profile()).toBe('Linus edits the board'), loaded)
  expect(location.pathname).toBe('/people/u3')
  await dispose()
  expect(container.querySelector('.routed')).toBeNull()
})

it('the server answers with the page and its loader result, so the browser hydrates without loading', async () => {
  const server = repo()
  const res = await handle(people, new Request('http://localhost/people/u1'), { layer: server.layer })
  expect(res.status).toBe(200)
  const html = await res.text()
  expect(html).toContain('<p class="profile">Ada<!--sleek-t--> <!--sleek-t-->edits the board</p>')

  const client = repo()
  history.replaceState(null, '', '/people/u1')
  const container = document.body.appendChild(document.createElement('div'))
  container.innerHTML = html
  const ssr = container.querySelector('.profile')
  const nav = await act(() => startRouter(people, { container, layer: client.layer }))
  expect(container.querySelector('.profile')).toBe(ssr)
  expect(client.get).not.toHaveBeenCalled()
  await act(() => nav.dispose())
  container.remove()
})
