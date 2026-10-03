import { expect, test } from '@playwright/test'

test('/atoms server HTML carries the seeded values', async ({ request }) => {
  const html = await (await request.get('/atoms')).text()
  expect(html).toContain('hello from the server')
  expect(html).toMatch(/run \d+ at /)
})

test('the seeded Effect atom does not run on the client', async ({ page }) => {
  await page.goto('/atoms')
  const time = page.getByTestId('server-time')
  await expect(time).toHaveText(/run \d+ at /)
  const before = await time.textContent()
  await page.waitForLoadState('networkidle')
  expect(await page.evaluate(() => (globalThis as { __ssrAtomRuns?: number }).__ssrAtomRuns)).toBeUndefined()
  await expect(time).toHaveText(before!)
})
