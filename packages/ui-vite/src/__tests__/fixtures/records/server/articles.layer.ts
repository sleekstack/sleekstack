import { RecordNotFound, RecordRejected } from '@sleekstack/model'
import { Effect, Layer } from 'effect'
import { ArticleAdapter } from '../src/article'

const table = new Map([['1', { id: '1', title: 'First' }]])

export default Layer.succeed(ArticleAdapter, {
  find: (id) => {
    const row = table.get(id)
    return row ? Effect.succeed(row) : Effect.fail(new RecordNotFound({ type: 'Article', id }))
  },
  save: (id, change: { readonly title: string }) => {
    if (!table.has(id)) return Effect.fail(new RecordNotFound({ type: 'Article', id }))
    if (change.title === '') return Effect.fail(new RecordRejected({ type: 'Article', id, message: 'empty title' }))
    const row = { id, ...change }
    table.set(id, row)
    return Effect.succeed(row)
  },
})
