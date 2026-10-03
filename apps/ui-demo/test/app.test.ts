// @vitest-environment jsdom
import { mount, renderToString } from '@sleekstack/ui'
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
