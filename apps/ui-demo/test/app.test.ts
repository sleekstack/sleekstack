// @vitest-environment jsdom
import { mount, renderToString } from '@sleekstack/ui'
import { expect, it } from 'vitest'
import { app, UserRepoLive } from '../src/app'

it('renders UserCard and the Catch fallback', async () => {
  expect(await renderToString(app('1'), { layer: UserRepoLive })).toBe('<div class="card"><h2>Ada</h2><span class="avatar">Ada</span></div>')
  const container = document.createElement('div')
  const m = await mount(app('2'), { layer: UserRepoLive, container })
  expect(container.innerHTML).toBe('<p>Not found</p>')
  await m.dispose()
})
