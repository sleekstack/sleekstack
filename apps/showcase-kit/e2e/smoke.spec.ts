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

test('board is in the server HTML and not fetched by the client on first paint', async ({ page, request }) => {
  const html = await (await request.get('/')).text()
  expect(html).toContain('aria-label="project: ')
  expect(html).not.toContain('Loading board')

  // readBoard is a Server Action: a client fetch of the board is a POST carrying a Next-Action header
  const actionPosts: string[] = []
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.headers()['next-action']) actionPosts.push(r.headers()['next-action'] + ' ' + r.postData())
  })
  await page.goto('/')
  await expect(page.locator('section[aria-label^="project:"]').first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(actionPosts).toEqual([])
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
  // the optimistic task is rolled back out of the cached board
  await expect(project.getByRole('button', { name: /should not persist/ })).toHaveCount(0)
  await project.getByLabel('Simulate failure').uncheck()

  await input.fill('')
  await create.click()
  await expect(project.getByRole('alert')).toHaveText('Task title cannot be empty')
})

test('move and comment update the board through the query cache', async ({ page }) => {
  await page.goto('/')
  const project = page.locator('section[aria-label^="project:"]').first()
  const title = `e2e move ${Date.now()}`
  await project.getByPlaceholder('New task title').fill(title)
  await project.getByRole('button', { name: 'Create task' }).click()
  await project.getByRole('button', { name: new RegExp(title) }).click()
  const detail = page.locator(`section[aria-label="task detail: ${title}"]`)
  await detail.getByRole('button', { name: 'done', exact: true }).click()
  await expect(project.getByRole('button', { name: new RegExp(`${title} — done \\(0\\)`) })).toBeVisible()
  await detail.getByLabel('new comment').fill('looks good')
  await detail.getByRole('button', { name: 'Comment' }).click()
  await expect(detail.getByRole('listitem').filter({ hasText: 'looks good' })).toBeVisible()
  await expect(project.getByRole('button', { name: new RegExp(`${title} — done \\(1\\)`) })).toBeVisible()
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
