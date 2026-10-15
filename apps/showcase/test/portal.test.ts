// @vitest-environment jsdom
import { flush, render } from '@sleekstack/testing'
import { renderToString } from '@sleekstack/ui'
import { jsx } from '@sleekstack/ui/jsx-runtime'
import { act } from 'react'
import { expect, it, vi } from 'vitest'
import { ViewerLive } from '../src/layers'
import { PortalDemo } from '../src/pages/portal'

const app = () => jsx(PortalDemo, {})
const layer = ViewerLive('u2')

/** Opens the dialog, checks it sits in `body` outside the view with the view's Viewer, and closes it. */
const openAndClose = async (container: HTMLElement) => {
  await act(async () => container.querySelector<HTMLButtonElement>('.open-dialog')!.click())
  await flush()
  const dialog = document.querySelector('.dialog')!
  expect(container.contains(dialog)).toBe(false)
  expect(dialog.textContent).toContain('Opened by Grace')
  await act(async () => dialog.querySelector<HTMLButtonElement>('.close')!.click())
  await flush()
  expect(document.querySelector('.dialog')).toBeNull()
}

it('opens the dialog in document.body with the Viewer of where it is rendered, and closes it', async () => {
  const { container, dispose } = await render(app(), { layer })
  await openAndClose(container)
  await dispose()
})

it('renders no portal on the server; after hydration the dialog opens', async () => {
  const html = await renderToString(app(), { layer })
  expect(html).not.toContain('class="dialog"')
  const onError = vi.fn()
  const { container, dispose } = await render(app(), { layer, hydrate: html, onError })
  await openAndClose(container)
  expect(onError).not.toHaveBeenCalled()
  await dispose()
})
