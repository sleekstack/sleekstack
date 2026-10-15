// @vitest-environment jsdom
// Also the showcase's `@sleekstack/testing` example: `render` mounts or hydrates, `flush` waits out renderer work and
// `mockLayer` stands in for the identity module's UserRepo.
import { flush, mockLayer, render } from '@sleekstack/testing'
import { renderToString } from '@sleekstack/ui'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { Effect } from 'effect'
import { act } from 'react'
import { expect, it, vi } from 'vitest'
import { type User, UserRepo } from '../src/modules/identity'
import { RouterDemo } from '../src/pages/router'

const team: ReadonlyArray<User> = [
  { id: 'u1', name: 'Ada', canEdit: true },
  { id: 'u2', name: 'Grace', canEdit: false },
  { id: 'u3', name: 'Linus', canEdit: true },
]
const repo = () => {
  const get = vi.fn((id: string) => Effect.succeed(team.find((u) => u.id === id)!))
  return { get, layer: mockLayer(UserRepo, { all: () => Effect.succeed(team), get }) }
}
const app = () => jsx(RouterDemo, {})

it('loads a profile under Pending; a hovered link is prefetched, so its click shows the profile at once', async () => {
  const { get, layer } = repo()
  const { container, dispose } = await render(app(), { layer })
  const text = (s: string) => container.querySelector(s)?.textContent
  const link = (id: string) => container.querySelector<HTMLAnchorElement>(`a[href="/people/${id}"]`)!
  expect(text('.router .muted')).toBe('Loading /people/u1')
  await flush()
  expect(text('.profile')).toBe('Ada edits the board')

  link('u2').dispatchEvent(new MouseEvent('mouseenter'))
  await vi.waitFor(() => expect(get).toHaveBeenLastCalledWith('u2'))
  await act(async () => link('u2').click())
  expect(text('.profile')).toBe('Grace reads the board')
  expect(get).toHaveBeenCalledTimes(2) // the click read the prefetched result

  await act(async () => link('u3').click())
  expect(text('.router .muted')).toBe('Loading /people/u3')
  await flush()
  expect(text('.profile')).toBe('Linus edits the board')
  await dispose()
})

it('renders the loaded profile on the server and hydrates it in place', async () => {
  const { layer } = repo()
  const html = await renderToString(app(), { layer })
  expect(html).toContain('<p class="profile">Ada<!--sleek-t--> <!--sleek-t-->edits the board</p>')
  const onError = vi.fn()
  const { container, dispose } = await render(app(), { layer, hydrate: html, onError })
  const profile = container.querySelector('.profile')
  expect(profile?.textContent).toBe('Ada edits the board')
  await flush()
  expect(container.querySelector('.profile')).toBe(profile)
  expect(onError).not.toHaveBeenCalled()
  await dispose()
})
