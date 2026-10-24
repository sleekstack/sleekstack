import { Effect, type Schema } from 'effect'
import { type Body, CommentMissing } from '../src/comments'

const comments = new Map([[1, 'first']])
let last = 1

export const list = (): Effect.Effect<ReadonlyArray<{ readonly id: number; readonly body: string }>> =>
  Effect.sync(() => [...comments].map(([id, body]) => ({ id, body })))

export const add = (input: { readonly body: Schema.Schema.Type<typeof Body> }): Effect.Effect<number> =>
  Effect.sync(() => {
    const id = ++last
    comments.set(id, input.body)
    return id
  })

const remove = (id: number): Effect.Effect<void, CommentMissing> =>
  comments.delete(id) ? Effect.void : Effect.fail(new CommentMissing({ id }))
export { remove as delete }

export const bodyLimit = 64
