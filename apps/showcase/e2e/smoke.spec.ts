import { expect, test } from '@playwright/test'

test('pages load', async ({ page }) => {
  for (const [url, heading] of [
    ['/', 'Team Task Board'],
    ['/graph', /graph/i],
    ['/errors', /error/i],
    ['/log', /log/i],
  ] as const) {
    const res = await page.goto(url)
    expect(res?.ok(), url).toBe(true)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading)
  }
})

test('create task: success, simulated failure, validation error', async ({ page }) => {
  await page.goto('/')
  const project = page.locator('section[aria-label^="project:"]').first()
  const input = project.getByPlaceholder('New task title')
  const create = project.getByRole('button', { name: 'Create task' })
  const title = `e2e task ${Date.now()}`

  await input.fill(title)
  await create.click()
  await expect(project.getByRole('button', { name: new RegExp(title) })).toBeVisible()

  await input.fill('should not persist')
  await project.getByLabel('Simulate failure').check()
  await create.click()
  await expect(project.getByRole('alert')).toHaveText('Simulated failure: create rejected before commit')
  await project.getByLabel('Simulate failure').uncheck()

  await input.fill('')
  await create.click()
  await expect(project.getByRole('alert')).toHaveText('Task title cannot be empty')
})

test('client navigation to /log keeps the component scope history', async ({ page }) => {
  await page.goto('/')
  const project = page.locator('section[aria-label^="project:"]').first()
  await project.getByRole('button', { name: /Wire up the graph explorer/ }).click()
  const scopeLog = page.getByRole('region', { name: 'component scope log' })
  await expect(scopeLog).toContainText('acquire: DraftEditor (task_1)')
  await project.getByRole('button', { name: 'Close' }).click()
  await expect(scopeLog).toContainText('release: DraftEditor (task_1)')

  await page.getByRole('navigation').getByRole('link', { name: 'Log' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Activity log')
  await expect(scopeLog).toContainText('acquire: DraftEditor (task_1)')
  await expect(scopeLog).toContainText('release: DraftEditor (task_1)')
})
