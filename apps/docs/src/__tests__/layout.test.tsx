// @vitest-environment jsdom
/** @jsxImportSource @sleekstack/ui */
import { flush, render } from '@sleekstack/testing'
import { within } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { Layer } from 'effect'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { DocsLayout } from '../layout/DocsLayout'
import { buildNav, flatPages, neighbours } from '../layout/nav'
import { themeScript } from '../layout/theme'

const order = { title: 'SleekStack', pages: ['index', 'concepts', 'ui', 'api'] }
const pages = [
  { slug: ['ui'], title: 'UI' },
  { slug: ['api', 'ui'], title: 'ui API' },
  { slug: ['api', 'core'], title: 'core API' },
  { slug: ['api', 'index'], title: 'API reference' },
  { slug: ['concepts'], title: 'Concepts' },
  { slug: ['index'], title: 'Welcome' },
]
const tree = buildNav(order, pages)
const mountAt = (current: string) =>
  render(
    <DocsLayout title="SleekStack" tree={tree} current={current}>
      <h1>Page</h1>
    </DocsLayout>,
    { layer: Layer.empty },
  )

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('sidebar and pager', () => {
  it('follows the order file, with the api folder last and its index first', () => {
    expect(tree.map((n) => n.title)).toEqual(['Welcome', 'Concepts', 'UI', 'API reference'])
    expect(flatPages(tree).map((p) => p.url)).toEqual([
      '/docs/index',
      '/docs/concepts',
      '/docs/ui',
      '/docs/api/index',
      '/docs/api/core',
      '/docs/api/ui',
    ])
  })

  it('previous and next follow that order', () => {
    expect(neighbours(tree, '/docs/ui')).toEqual({
      prev: { title: 'Concepts', url: '/docs/concepts' },
      next: { title: 'API reference', url: '/docs/api/index' },
    })
    expect(neighbours(tree, '/docs/index').prev).toBeUndefined()
  })

  it('highlights the current page, opens its folder, and collapses a folder', async () => {
    const { container } = await mountAt('/docs/api/core')
    const ui = within(container)
    expect(ui.getByRole('link', { name: 'core API' }).getAttribute('aria-current')).toBe('page')
    await userEvent.click(ui.getByRole('button', { name: 'Toggle API reference' }))
    await flush()
    expect(ui.queryByRole('link', { name: 'core API' })).toBeNull()
  })

  it('is a drawer: the menu opens it and a link closes it', async () => {
    const { container } = await mountAt('/docs/index')
    const ui = within(container)
    const nav = () => container.querySelector('nav')!
    expect(nav().classList.contains('open')).toBe(false)
    await userEvent.click(ui.getByRole('button', { name: 'Menu' }))
    await flush()
    expect(nav().classList.contains('open')).toBe(true)
    await userEvent.click(ui.getByRole('link', { name: 'Concepts' }))
    await flush()
    expect(nav().classList.contains('open')).toBe(false)
  })
})

describe('theme', () => {
  it('defaults to the system setting', async () => {
    const { container } = await mountAt('/docs/index')
    await flush()
    expect(within(container).getByRole('button', { name: 'system' }).getAttribute('aria-pressed')).toBe('true')
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(readFileSync('src/styles.css', 'utf8')).toContain('prefers-color-scheme: dark')
  })

  it('remembers an explicit choice across a remount', async () => {
    const first = await mountAt('/docs/index')
    await userEvent.click(within(first.container).getByRole('button', { name: 'dark' }))
    await flush()
    expect(document.documentElement.dataset.theme).toBe('dark')
    await first.dispose()
    const second = await mountAt('/docs/index')
    await flush()
    expect(within(second.container).getByRole('button', { name: 'dark' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('the head script sets the stored theme before any component runs', () => {
    localStorage.setItem('theme', 'dark')
    new Function(themeScript)()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

describe('stylesheet', () => {
  const css = readFileSync('src/styles.css', 'utf8')
  it.each(['.prose table', '.prose code', '.prose pre', '.prose blockquote'])('styles %s', (selector) => {
    expect(css).toContain(selector)
  })
  it('references no Tailwind or fumadocs', () => {
    expect(css).not.toMatch(/tailwind|fumadocs/i)
  })
})
