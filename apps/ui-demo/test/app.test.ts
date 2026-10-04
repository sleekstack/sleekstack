// @vitest-environment jsdom
import { mount, renderToString } from '@sleekstack/ui'
import { act } from 'react'
import { expect, it, vi } from 'vitest'
import { App } from '../src/app'
import { AppWithQueriesLive } from '../src/infrastructure'

const AppLive = AppWithQueriesLive({ defaultOptions: { queries: { retry: false } } })

const view = (viewer: string) => renderToString(App({ viewer }), { layer: AppLive })

it('renders the board for Ada, with every failure caught by its Boundary', async () => {
  const html = await view('u1')
  expect(html).toContain('<h2>Launch</h2>')
  expect(html).toContain('Wire the mount layer')
  expect(html).toContain('<em class="you">you</em>') // Ada is the assignee of t1 and the viewer
  expect(html).toContain('Unassigned')
  expect(html).toContain('Unknown user <!--sleek-t-->ghost') // UserNotFound inside a card; text separator from renderToString
  expect(html).toContain('No project &quot;<!--sleek-t-->missing<!--sleek-t-->&quot;') // ProjectNotFound
  expect(html).toContain('No task &quot;<!--sleek-t-->nope<!--sleek-t-->&quot;') // TaskNotFound
  expect(html).toContain('Ada<!--sleek-t--> can edit this task')
  expect(html).toContain('<li>Document Boundary</li>') // renderToString awaits Pending content
  expect(html).not.toContain('Loading backlog')
})

it('scopes the Viewer per mount: Grace reads only', async () => {
  const html = await view('u2')
  expect(html).toContain('Read only')
  expect(html).not.toContain('can edit this task')
})

it('mounts into the DOM and guests render', async () => {
  const container = document.createElement('div')
  const m = await mount(App({ viewer: 'u1' }), { layer: AppLive, container })
  const vote = container.querySelector<HTMLButtonElement>('button.vote')!
  expect(vote.textContent).toBe('▲ 0') // first card: t3 in To do
  await m.dispose()
})

it('a filter click re-renders only the columns; a task pick replaces the detail', async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const tick = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))
  const container = document.createElement('div')
  let m!: Awaited<ReturnType<typeof mount>>
  await act(async () => void (m = await mount(App({ viewer: 'u1' }), { layer: AppLive, container })))
  const click = (v: string) => act(async () => container.querySelector<HTMLButtonElement>(`button[data-value="${v}"]`)!.click())
  const header = container.querySelector('header')
  const team = container.querySelector('.team')
  const doneBtn = container.querySelector('button[data-value="done"]')
  expect(container.querySelectorAll('.board .column')).toHaveLength(3)

  await click('done')
  await tick()
  const columns = [...container.querySelectorAll('.board .column h3')].map((h) => h.firstChild!.textContent!.trim())
  expect(columns).toEqual(['Done'])
  expect(container.querySelector('header')).toBe(header)
  expect(container.querySelector('.team')).toBe(team)
  expect(container.querySelector('button[data-value="done"]')).toBe(doneBtn) // the filter bar did not remount

  const detail = () => container.querySelector('.selected')!
  expect(detail().querySelector('h2')!.textContent).toBe('Write the analyzer pass')
  await click('t1')
  await tick()
  expect(detail().querySelector('h2')!.textContent).toBe('Wire the mount layer')
  await click('nope')
  await tick()
  expect(detail().textContent).toBe('No task "nope"') // TaskNotFound fallback
  await click('t3')
  await tick()
  expect(detail().querySelector('h2')!.textContent).toBe('Pick a package name')
  expect(container.querySelector('header')).toBe(header)
  await act(() => m.dispose())
})

it('the backlog shows the Pending fallback, then loads through useSuspenseQuery; a guest-triggered mutation updates it, siblings keep their nodes', async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  let sawFallback = false
  const seen = new MutationObserver(() => void (sawFallback ||= container.querySelector('.backlog-panel .spinner') !== null))
  seen.observe(container, { childList: true, subtree: true })
  let m!: Awaited<ReturnType<typeof mount>>
  await act(async () => void (m = await mount(App({ viewer: 'u1' }), { layer: AppLive, container })))
  const items = () => [...container.querySelectorAll('.backlog li')].map((li) => li.textContent)
  await vi.waitFor(() => expect(items()).toEqual(['Document Boundary']))
  seen.disconnect()
  expect(sawFallback).toBe(true)
  expect(container.querySelector('.backlog-panel .spinner')).toBeNull()
  const header = container.querySelector('header')
  const board = container.querySelector('.board')
  const add = container.querySelector<HTMLButtonElement>('button.add')!

  await act(async () => add.click())
  await vi.waitFor(() => expect(items()).toEqual(['Document Boundary', 'New task']))
  expect(container.querySelector('header')).toBe(header)
  expect(container.querySelector('.board')).toBe(board)
  await act(() => m.dispose())
})

it('triage: keyed rows reorder in place, the input keeps focus, guests keep state, host onClick and useLocal toggle', async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const tick = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))
  const container = document.createElement('div')
  document.body.append(container)
  let m!: Awaited<ReturnType<typeof mount>>
  await act(async () => void (m = await mount(App({ viewer: 'u1' }), { layer: AppLive, container })))
  const rows = () => [...container.querySelectorAll<HTMLLIElement>('.triage-list li')]
  const ids = () => rows().map((li) => li.dataset.id)
  const row = (id: string) => container.querySelector<HTMLLIElement>(`.triage-list li[data-id="${id}"]`)!
  expect(ids()).toEqual(['t3', 't4', 't1', 't2'])
  const t3 = row('t3')
  await act(async () => t3.querySelector<HTMLButtonElement>('button.vote')!.click())
  expect(t3.querySelector('button.vote')!.textContent).toBe('▲ 1')

  const input = container.querySelector<HTMLInputElement>('input.search')!
  input.focus()
  await act(async () => container.querySelector<HTMLButtonElement>('button.sort')!.click())
  await tick()
  expect(ids()).toEqual(['t2', 't1', 't4', 't3'])
  expect(row('t3')).toBe(t3) // same node, moved
  expect(t3.querySelector('button.vote')!.textContent).toBe('▲ 1') // the guest kept its count
  expect(document.activeElement).toBe(input)

  input.value = 'w'
  await act(async () => void input.dispatchEvent(new Event('input')))
  await tick()
  expect(ids()).toEqual(['t2', 't1', 't4']) // Write, Wire, Review
  expect(container.querySelector('input.search')).toBe(input)
  expect(document.activeElement).toBe(input)

  await act(async () => container.querySelector<HTMLButtonElement>('button.collapse')!.click())
  await tick()
  expect(container.querySelector('.triage-list')).toBeNull()
  await act(async () => container.querySelector<HTMLButtonElement>('button.collapse')!.click())
  await tick()
  expect(ids()).toEqual(['t2', 't1', 't4'])
  await act(() => m.dispose())
  container.remove()
})
