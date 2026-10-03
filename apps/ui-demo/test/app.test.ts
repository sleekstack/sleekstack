// @vitest-environment jsdom
import { mount, renderToString } from '@sleekstack/ui'
import { act } from 'react'
import { expect, it } from 'vitest'
import { App } from '../src/components'
import { AppLive } from '../src/domain'

const view = (viewer: string) => renderToString(App({ viewer }), { layer: AppLive })

it('renders the board for Ada, with every failure caught by its Boundary', async () => {
  const html = await view('u1')
  expect(html).toContain('<h2>Launch</h2>')
  expect(html).toContain('Wire the mount layer')
  expect(html).toContain('<em class="you">you</em>') // Ada is the assignee of t1 and the viewer
  expect(html).toContain('Unassigned')
  expect(html).toContain('Unknown user ghost') // UserNotFound inside a card
  expect(html).toContain('No project &quot;missing&quot;') // ProjectNotFound
  expect(html).toContain('No task &quot;nope&quot;') // TaskNotFound
  expect(html).toContain('Ada can edit this task')
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

it('a filter click re-renders only the columns; a task pick swaps the detail', async () => {
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
