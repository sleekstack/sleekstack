import { expect, test } from '@playwright/test'

test('Island keeps server DOM, survives a wrapper re-render, hydrates on visible', async ({ page }) => {
  const warnings: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') warnings.push(m.text())
  })
  await page.goto('/islands')

  // load island hydrates and becomes interactive
  const loadBtn = page.getByRole('region', { name: 'load island' }).getByRole('button')
  await loadBtn.click()
  await expect(loadBtn).toHaveText('count 11')

  const host = page.getByRole('region', { name: 'visible island' })
  const btn = host.getByRole('button', { name: /^count/ })
  await expect(btn).toHaveText('count 3') // server HTML, below the fold
  const rendersBefore = await page.evaluate(() => (window as { __islandRenders?: number }).__islandRenders ?? 0)
  await page.evaluate(() => {
    ;(window as { __node?: Element | null }).__node = document.querySelector('[aria-label="visible island"] [data-island] button')
  })

  // Wrapper re-render before hydration must not rewrite the dormant DOM.
  await host.getByRole('button', { name: /rerender wrapper/ }).dispatchEvent('click')
  await expect(host.getByRole('button', { name: 'rerender wrapper 1' })).toBeAttached()
  const same = () =>
    page.evaluate(
      () =>
        (window as { __node?: Element | null }).__node ===
        document.querySelector('[aria-label="visible island"] [data-island] button'),
    )
  expect(await same()).toBe(true)
  expect(await page.evaluate(() => (window as { __islandRenders?: number }).__islandRenders ?? 0)).toBe(rendersBefore)

  // Scroll: visible trigger hydrates; node identity preserved, becomes interactive.
  await btn.scrollIntoViewIfNeeded()
  await expect.poll(() => page.evaluate(() => (window as { __islandRenders?: number }).__islandRenders ?? 0)).toBeGreaterThan(rendersBefore)
  expect(await same()).toBe(true)
  await btn.click()
  await expect(btn).toHaveText('count 4')

  // Re-render after hydration: DOM still not rewritten, state kept.
  await host.getByRole('button', { name: /rerender wrapper/ }).click()
  await expect(host.getByRole('button', { name: 'rerender wrapper 2' })).toBeVisible()
  expect(await same()).toBe(true)
  await expect(btn).toHaveText('count 4')

  expect(warnings).toEqual([])
})

const hydrated = (page: import('@playwright/test').Page, id: string) =>
  page.evaluate((k) => (window as { __hydrated?: Record<string, boolean> }).__hydrated?.[k] === true, id)

test.describe('interaction trigger', () => {
  test('first click on a plain button hydrates and fires the handler exactly once', async ({ page }) => {
    await page.goto('/islands')
    const btn = page.getByRole('region', { name: 'interaction button' }).getByRole('button')
    await expect(btn).toHaveText('clicks 0')
    expect(await hydrated(page, 'button')).toBe(false)
    await btn.click()
    await expect(btn).toHaveText('clicks 1')
    await page.waitForTimeout(200)
    await expect(btn).toHaveText('clicks 1')
    await btn.click()
    await expect(btn).toHaveText('clicks 2')
  })

  test('checkbox is not double-toggled', async ({ page }) => {
    await page.goto('/islands')
    const box = page.getByRole('region', { name: 'interaction checkbox' }).getByRole('checkbox')
    await box.click()
    await expect.poll(() => hydrated(page, 'checkbox')).toBe(true)
    await page.waitForTimeout(200)
    await expect(box).toBeChecked()
  })

  test('link is not double-navigated or replayed', async ({ page }) => {
    await page.goto('/islands')
    const before = await page.evaluate(() => history.length)
    const link = page.getByRole('region', { name: 'interaction link' }).getByRole('link')
    await link.click()
    await expect.poll(() => hydrated(page, 'link')).toBe(true)
    await page.waitForTimeout(200)
    expect(page.url()).toMatch(/#link$/)
    expect(await page.evaluate(() => history.length)).toBe(before + 1)
    await expect(link).toHaveText('link 0') // the pre-hydration click was not replayed into React
  })

  test('focus and keydown only start hydration', async ({ page }) => {
    await page.goto('/islands')
    const btn = page.getByRole('region', { name: 'interaction keyboard' }).getByRole('button')
    await btn.focus()
    await expect.poll(() => hydrated(page, 'keyboard')).toBe(true)
    await page.keyboard.down('Shift')
    await page.keyboard.up('Shift')
    await page.waitForTimeout(200)
    await expect(btn).toHaveText('clicks 0')
  })
})

test.describe('shared app scope and triggers', () => {
  test('idle Islands share the app-scope service and keep separate component scopes', async ({ page }) => {
    await page.goto('/islands')
    const a = page.getByRole('region', { name: 'shared a' })
    const b = page.getByRole('region', { name: 'shared b' })
    await expect(a.getByRole('button', { name: 'shared 0' })).toBeAttached() // server HTML
    await expect.poll(() => hydrated(page, 'shared-a')).toBe(true)
    await expect.poll(() => hydrated(page, 'shared-b')).toBe(true)
    await a.getByRole('button', { name: /^shared/ }).click()
    await expect(b.getByRole('button', { name: /^shared/ })).toHaveText('shared 1')
    await a.getByRole('button', { name: /^local/ }).click()
    await expect(a.getByRole('button', { name: /^local/ })).toHaveText('local 1')
    await expect(b.getByRole('button', { name: /^local/ })).toHaveText('local 0')
  })

  test('an interaction Island calls a kit Server Action; the first click is replayed once', async ({ page }) => {
    await page.goto('/islands')
    const host = page.getByRole('region', { name: 'action island' })
    const btn = host.getByRole('button')
    await expect(btn).toHaveText('ping 0')
    await btn.click()
    await expect(host.locator('output')).toHaveText('ok island')
    await expect(btn).toHaveText('ping 1')
  })

  test('server DOM nodes survive hydration for every trigger', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text())
    })
    // Capture each Island's server-rendered child as the parser inserts it, before any client script runs.
    await page.addInitScript(() => {
      const nodes: Element[] = ((window as { __nodes?: Element[] }).__nodes = [])
      new MutationObserver((records) => {
        for (const r of records)
          for (const n of r.addedNodes)
            if (n instanceof Element && n.parentElement?.hasAttribute('data-island') && !nodes.includes(n)) nodes.push(n)
      }).observe(document, { childList: true, subtree: true })
    })
    await page.goto('/islands')
    // load + idle hydrate on their own; interaction on a click; visible on scroll.
    await page.getByRole('region', { name: 'interaction button' }).getByRole('button').click()
    await page.getByRole('region', { name: 'action island' }).getByRole('button').click()
    await page.getByRole('region', { name: 'visible island' }).getByRole('button', { name: /^count/ }).scrollIntoViewIfNeeded()
    for (const id of ['button', 'shared-a', 'shared-b']) await expect.poll(() => hydrated(page, id)).toBe(true)
    await expect(page.getByRole('region', { name: 'action island' }).locator('output')).toHaveText('ok island')
    await expect(page.getByRole('region', { name: 'visible island' }).getByRole('button', { name: /^count/ })).toHaveText('count 3')
    const kept = await page.evaluate(() => {
      const before = (window as { __nodes?: Element[] }).__nodes ?? []
      const now = [...document.querySelectorAll('[data-island] > *')]
      return { count: before.length, same: before.length === now.length && before.every((n, i) => n === now[i]) }
    })
    expect(kept.count).toBeGreaterThanOrEqual(9)
    expect(kept.same).toBe(true)
    expect(errors).toEqual([])
  })
})

test('useId in an Island is benign: no hydration error, server ids kept in the DOM, client id differs', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/islands')
  const host = page.getByRole('region', { name: 'useId island' })
  const serverId = await host.locator('input').getAttribute('id')
  await expect.poll(() => hydrated(page, 'ided')).toBe(true)
  // A fresh root restarts the id tree: the client value differs, but hydration keeps the server attribute.
  const clientId = await page.evaluate(() => (window as { __clientUseId?: string }).__clientUseId)
  expect(clientId).toBeTruthy()
  expect(clientId).not.toBe(serverId)
  await expect(host.locator('input')).toHaveAttribute('id', serverId!)
  await expect(host.getByLabel('named field')).toBeAttached() // label/for pairing intact
  // The Island and the rest of the page keep working.
  await host.getByRole('button').click()
  await expect(host.getByRole('button')).toHaveText('ided 1')
  const loadBtn = page.getByRole('region', { name: 'load island' }).getByRole('button')
  await loadBtn.click()
  await expect(loadBtn).toHaveText('count 11')
  expect(errors).toEqual([])
})
