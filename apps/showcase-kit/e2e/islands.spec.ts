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
