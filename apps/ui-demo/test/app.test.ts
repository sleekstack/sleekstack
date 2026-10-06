// @vitest-environment jsdom
import { mount, renderToString } from '@sleekstack/ui'
import { act } from 'react'
import { expect, it, vi } from 'vitest'
import { App } from '../src/app'
import { AppWithQueriesLive } from '../src/infrastructure'

const AppLive = AppWithQueriesLive({ defaultOptions: { queries: { retry: false } } })

const view = (viewer: string) => renderToString(App({ viewer }), { layer: AppLive })
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))
const mountApp = async (viewer: string, attach = false) => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  if (attach) document.body.append(container)
  let m!: Awaited<ReturnType<typeof mount>>
  await act(async () => void (m = await mount(App({ viewer }), { layer: AppLive, container })))
  const q = <T extends Element>(s: string) => container.querySelector<T>(s)!
  const click = (s: string) => act(async () => q<HTMLElement>(s).click())
  await vi.waitFor(() => expect(container.querySelector('.workspace')).not.toBeNull())
  return { container, q, click, dispose: () => act(() => m.dispose()) }
}

it('renders the first project for Ada: tasks, labels, assignees and a form for editors', async () => {
  const html = await view('u1')
  expect(html).toContain('<h2>Website relaunch</h2>')
  expect(html).toContain('Fix the checkout redirect loop')
  expect(html).toContain('<em class="you">you</em>') // Ada owns t1 and is the viewer
  expect(html).toContain('Unassigned')
  expect(html).toContain('Left the team') // t4 names a user who is gone: the Boundary catches UserNotFound
  expect(html).toContain('class="add"') // editors get the new-task form
  expect(html).toContain('Select a task')
  expect(html).not.toContain('Loading tasks') // renderToString awaits Pending content
})

it('scopes the Viewer per mount: Grace reads only', async () => {
  const html = await view('u2')
  expect(html).toContain('cannot add tasks')
  expect(html).not.toContain('class="add"')
})

it('a status filter re-renders only the columns', async () => {
  const { container, q, click, dispose } = await mountApp('u1')
  const header = q('header')
  const team = q('.team')
  const doneBtn = q('button[data-value="done"]')
  expect(container.querySelectorAll('.board .column')).toHaveLength(3)

  await click('button[data-value="done"]')
  await settle()
  const columns = [...container.querySelectorAll('.board .column h3')].map((h) => h.firstChild!.textContent!.trim())
  expect(columns).toEqual(['Done'])
  expect(q('header')).toBe(header)
  expect(q('.team')).toBe(team)
  expect(q('button[data-value="done"]')).toBe(doneBtn) // the filter bar did not remount
  await dispose()
})

it('opens a task, moves it through a mutation and the board follows; viewers cannot edit', async () => {
  const { container, q, click, dispose } = await mountApp('u1')
  const column = (title: string) => q(`.card[data-id="${title}"]`).closest('.column')!.querySelector('h3')!.firstChild!.textContent!.trim()
  expect(column('t3')).toBe('To do')
  await click('.card[data-id="t3"] button.open')
  await settle()
  expect(q('.selected h2').textContent).toBe('Pick a cookie consent provider')

  const board = q('.board')
  await click('.selected button.move[data-status="in_progress"]')
  await vi.waitFor(() => expect(column('t3')).toBe('In progress'))
  expect(q('.board')).toBe(board) // the project page did not remount
  expect(q('.selected .badge').textContent).toBe('In progress')
  await dispose()

  const grace = await mountApp('u2')
  await grace.click('.card[data-id="t3"] button.open')
  await settle()
  expect(grace.container.querySelector('.selected button.move')).toBeNull()
  expect(grace.q('.selected').textContent).toContain('Read only')
  await grace.dispose()
})

it('the form adds a task; deleting the open task shows the TaskNotFound fallback', async () => {
  const { container, q, click, dispose } = await mountApp('u1')
  const title = q<HTMLInputElement>('.new-title')
  // React-controlled input: set through the native setter so the change is seen.
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    set.call(title, 'Rotate the API keys')
    title.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => void q<HTMLFormElement>('form.add').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  await vi.waitFor(() => expect(container.textContent).toContain('Rotate the API keys'))
  expect(container.querySelectorAll('.board .card')).toHaveLength(5)

  await click('.card[data-id="t3"] button.open')
  await settle()
  await click('.selected button.delete')
  await vi.waitFor(() => expect(q('.selected').textContent).toBe('This task no longer exists'))
  expect(container.querySelector('.card[data-id="t3"]')).toBeNull()
  await dispose()
})

it('switching project loads its tasks; an archived bookmark shows ProjectNotFound', async () => {
  const { container, q, click, dispose } = await mountApp('u1')
  const header = q('header')
  await click('button[data-project="p2"]')
  await vi.waitFor(() => expect(q('.board h2').textContent).toBe('Mobile app'))
  await vi.waitFor(() => expect(container.querySelectorAll('.board .card')).toHaveLength(2))
  await click('button[data-project="p0"]')
  await vi.waitFor(() => expect(container.querySelector('.error')!.textContent).toBe('No project "p0"'))
  expect(q('header')).toBe(header)
  await dispose()
})

it('triage: keyed rows reorder in place, the input keeps focus, guests keep state, useLocal toggles', async () => {
  const { container, q, click, dispose } = await mountApp('u1', true)
  const rows = () => [...container.querySelectorAll<HTMLLIElement>('.triage-list li')]
  const ids = () => rows().map((li) => li.dataset.id)
  const row = (id: string) => container.querySelector<HTMLLIElement>(`.triage-list li[data-id="${id}"]`)!
  expect(ids()).toEqual(['t4', 't2', 't1', 't3']) // A-Z by title
  const t4 = row('t4')
  await act(async () => t4.querySelector<HTMLButtonElement>('button.vote')!.click())
  expect(t4.querySelector('button.vote')!.textContent).toBe('▲ 2')

  const input = q<HTMLInputElement>('input.search')
  input.focus()
  await click('button.sort')
  await settle()
  expect(ids()).toEqual(['t3', 't1', 't2', 't4'])
  expect(row('t4')).toBe(t4) // same node, moved
  expect(t4.querySelector('button.vote')!.textContent).toBe('▲ 2') // the guest kept its count
  expect(document.activeElement).toBe(input)

  input.value = 'the'
  await act(async () => void input.dispatchEvent(new Event('input')))
  await settle()
  expect(ids()).toEqual(['t1', 't2', 't4']) // titles with "the", still Z-A
  expect(q('input.search')).toBe(input)
  expect(document.activeElement).toBe(input)

  await click('button.collapse')
  await settle()
  expect(container.querySelector('.triage-list')).toBeNull()
  await click('button.collapse')
  await settle()
  expect(ids()).toEqual(['t1', 't2', 't4'])
  await dispose()
  container.remove()
})
