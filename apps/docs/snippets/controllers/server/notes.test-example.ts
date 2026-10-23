import { callController } from '@sleekstack/testing'
import { Effect, Layer } from 'effect'
import app, { type Controllers } from 'virtual:sleek/server-app'
import { expect, it } from 'vitest'
import { NoteNotFound, Notes } from './notes'

/** A Controller's entry in the discovered app: the Schemas and options its erased annotations cannot carry. */
const entry = (route: keyof Controllers) => app.controllers.find((controller) => controller.route === route)!

const Empty = Layer.succeed(Notes, {
  list: () => Effect.succeed([]),
  find: (id) => Effect.fail(new NoteNotFound({ id })),
  create: (title, author) => Effect.succeed({ id: 1, title, author }),
  remove: (id) => Effect.fail(new NoteNotFound({ id })),
})

it('the directory wrap answers a missing note as a JSON 404', async () => {
  const response = await callController(entry('notes/[id]'), new Request('http://x.test/notes/7'), { layer: Empty })
  expect([response.status, await response.json()]).toEqual([404, { error: 'no note 7' }])
})

it('an empty title fails the body decode, which the wrap answers as 422', async () => {
  const post = new Request('http://x.test/notes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: '' }),
  })
  expect((await callController(entry('notes'), post, { layer: Empty })).status).toBe(422)
})
