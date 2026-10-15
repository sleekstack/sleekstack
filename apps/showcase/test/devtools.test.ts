// @vitest-environment jsdom
import { uiTrace } from '@sleekstack/devtools'
import { render } from '@sleekstack/testing'
import { renderToString } from '@sleekstack/ui'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { Layer } from 'effect'
import { act } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { openDevtools } from '../src/devtools'
import { DevtoolsDemo } from '../src/pages/devtools'

const app = () => jsx(DevtoolsDemo, {})
afterEach(() => vi.unstubAllEnvs())

it('in development the page links the panel that openDevtools mounts at #devtools', async () => {
  const html = await renderToString(app(), { layer: Layer.empty })
  const { container, dispose } = await render(app(), { layer: Layer.empty, hydrate: html })
  expect(container.querySelector('a')!.getAttribute('href')).toBe('#devtools')
  await act(async () => openDevtools(uiTrace()))
  const panel = document.getElementById('devtools')!
  expect(panel.childElementCount).toBeGreaterThan(0)
  panel.remove()
  await dispose()
})

it('a production build has no panel to link', async () => {
  vi.stubEnv('DEV', false)
  const html = await renderToString(app(), { layer: Layer.empty })
  expect(html).not.toContain('#devtools')
  expect(html).toContain('A production build leaves the devtools panel out')
})
