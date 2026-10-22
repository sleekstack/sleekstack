import { expect, it } from 'vitest'
import { app } from './server'

it('serves the discovered app under vitest', async () => {
  expect((await app.fetch(new Request('http://x.test/'))).status).toBe(404)
})
