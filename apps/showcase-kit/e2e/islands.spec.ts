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
