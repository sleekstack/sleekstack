// @vitest-environment jsdom
/** @jsxImportSource @sleekstack/ui */
import { flush, render } from '@sleekstack/testing'
import { within } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { Layer } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { SearchDialog } from '../search/SearchDialog'

const index = {
  version: 1,
  entries: [
    { title: 'Guide', heading: 'Setup', anchor: '/guide#setup', text: 'install the package' },
    { title: 'Guide', heading: 'Usage', anchor: '/guide#usage', text: 'install once, use anywhere' },
  ],
}
const ok = (async () => Response.json(index)) as unknown as typeof fetch
const broken = (async () => new Response('', { status: 500 })) as unknown as typeof fetch

const mount = (fetcher: typeof fetch = ok) => {
  const navigate = vi.fn()
  const view = render(<SearchDialog indexUrl="/search-index.json" fetcher={fetcher} navigate={navigate} />, {
    layer: Layer.empty,
  })
  return view.then((v) => ({ ...v, navigate, ui: within(document.body) }))
}

describe('search dialog', () => {
  it('opens on ctrl-K with focus in the input and closes on escape', async () => {
    const { ui, dispose } = await mount()
    expect(ui.queryByRole('dialog')).toBeNull()
    await userEvent.keyboard('{Control>}k{/Control}')
    await flush()
    expect(ui.getByRole('dialog', { name: 'Search documentation' })).toBeTruthy()
    expect(document.activeElement).toBe(ui.getByRole('combobox'))
    await userEvent.keyboard('{Escape}')
    await flush()
    expect(ui.queryByRole('dialog')).toBeNull()
    await dispose()
  })

  const openWithResults = async () => {
    const view = await mount()
    await userEvent.click(view.ui.getByRole('button', { name: 'Search' }))
    await flush()
    await userEvent.keyboard('install')
    await flush()
    return view
  }

  it('escape from a result link closes and returns focus to the trigger', async () => {
    const { ui, dispose } = await openWithResults()
    await userEvent.tab()
    expect(document.activeElement).toBe(ui.getAllByRole('link')[0])
    await userEvent.keyboard('{Escape}')
    await flush()
    expect(ui.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(ui.getByRole('button', { name: 'Search' }))
    await dispose()
  })

  it('keeps focus inside the dialog: tab and shift-tab wrap', async () => {
    const { ui, dispose } = await openWithResults()
    const [first, second] = ui.getAllByRole('link')
    const input = ui.getByRole('combobox')
    await userEvent.tab()
    await userEvent.tab()
    expect(document.activeElement).toBe(second)
    await userEvent.tab()
    expect(document.activeElement).toBe(input)
    await userEvent.tab({ shift: true })
    expect(document.activeElement).toBe(second)
    await userEvent.tab({ shift: true })
    expect(document.activeElement).toBe(first)
    await dispose()
  })

  it('opens on meta-K too', async () => {
    const { ui, dispose } = await mount()
    await userEvent.keyboard('{Meta>}k{/Meta}')
    await flush()
    expect(ui.getByRole('dialog')).toBeTruthy()
    await dispose()
  })

  it('arrows move through the results and enter navigates', async () => {
    const { ui, navigate, dispose } = await mount()
    await userEvent.keyboard('{Control>}k{/Control}')
    await flush()
    await userEvent.keyboard('install')
    await flush()
    const selected = () => ui.getAllByRole('option').map((o) => o.getAttribute('aria-selected'))
    expect(ui.getByRole('listbox')).toBeTruthy()
    expect(selected()).toEqual(['true', 'false'])
    await userEvent.keyboard('{ArrowDown}')
    await flush()
    expect(selected()).toEqual(['false', 'true'])
    await userEvent.keyboard('{Enter}')
    await flush()
    expect(navigate).toHaveBeenCalledWith('/guide#usage')
    expect(ui.queryByRole('dialog')).toBeNull()
    await dispose()
  })

  it('shows nothing for an empty query and a message for no results', async () => {
    const { ui, dispose } = await mount()
    await userEvent.keyboard('{Control>}k{/Control}')
    await flush()
    expect(ui.queryAllByRole('option')).toEqual([])
    expect(ui.queryByText(/No results/)).toBeNull()
    await userEvent.keyboard('zzzz')
    await flush()
    expect(ui.getByText(/No results for "zzzz"/)).toBeTruthy()
    await dispose()
  })

  it('shows an error when the index cannot load', async () => {
    const { ui, dispose } = await mount(broken)
    await userEvent.keyboard('{Control>}k{/Control}')
    await flush()
    expect(ui.getByRole('alert').textContent).toMatch(/could not be loaded/)
    await dispose()
  })
})
